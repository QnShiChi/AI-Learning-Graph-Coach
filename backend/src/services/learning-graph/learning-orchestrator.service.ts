import { GraphGenerationService } from './graph-generation.service.js';
import { GraphValidationService, type DraftConcept } from './graph-validation.service.js';
import { InputNormalizationService } from './input-normalization.service.js';
import { LessonPackageService } from './lesson-package.service.js';
import { MasteryService } from './mastery.service.js';
import { PathEngineService } from './path-engine.service.js';
import { QuizService } from './quiz.service.js';
import { SessionService } from './session.service.js';
import { TutorService } from './tutor.service.js';
import { VoiceTutorService } from './voice-tutor.service.js';
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import logger from '@/utils/logger.js';
import crypto from 'node:crypto';

export class LearningOrchestratorService {
  private inputNormalization = new InputNormalizationService();
  private graphGeneration = new GraphGenerationService();
  private graphValidation = new GraphValidationService();
  private lessonPackageService = new LessonPackageService();
  private pathEngine = new PathEngineService();
  private masteryService = new MasteryService();
  private sessionService = new SessionService();
  private quizService = new QuizService();
  private tutorService = new TutorService();
  private voiceTutorService = new VoiceTutorService();

  private buildPrerequisiteMap(
    edges: Array<{ fromConceptId: string; toConceptId: string; edgeType: string }>
  ) {
    const prerequisiteMap: Record<string, string[]> = {};

    for (const edge of edges) {
      if (edge.edgeType !== 'prerequisite') {
        continue;
      }

      prerequisiteMap[edge.toConceptId] = [
        ...(prerequisiteMap[edge.toConceptId] ?? []),
        edge.fromConceptId,
      ];
    }

    return prerequisiteMap;
  }

  private resolvePersistedQuizOrThrow(quizPayload: unknown) {
    const quiz = this.quizService.parseStoredQuizPayload(quizPayload);

    if (!quiz) {
      throw new AppError(
        'Không thể đọc nội dung quiz đã lưu. Hãy tạo quiz mới và thử lại.',
        500,
        ERROR_CODES.LEARNING_GRAPH_INVALID
      );
    }

    return quiz;
  }

  private async assertSessionAccess(userId: string, sessionId: string) {
    const session = await this.sessionService.findSessionByIdForUser(userId, sessionId);
    if (!session) {
      throw new AppError('Không tìm thấy phiên học.', 404, ERROR_CODES.LEARNING_SESSION_NOT_FOUND);
    }

    return session;
  }

  async createSession(input: { userId: string; topic: string; sourceText?: string }) {
    const normalized = this.inputNormalization.normalize(input.topic, input.sourceText);
    const session = await this.sessionService.createLearningSession({
      userId: input.userId,
      goalTitle: input.topic,
      sourceTopic: input.topic,
      sourceText: normalized.sourceText,
    });

    const rawGraph = await this.graphGeneration.generate(normalized.rawText);
    const validatedGraph = this.graphValidation.validate(rawGraph);

    if (validatedGraph.concepts.length === 0) {
      logger.warn('Learning graph generation produced no usable concepts', {
        sessionId: session.id,
        topic: input.topic,
        rawGraphKeys: Object.keys(rawGraph),
        edgeCount: validatedGraph.edges.length,
      });
      throw new AppError(
        'Không thể tạo lộ trình học từ nội dung đã nhập. Hãy bổ sung tài liệu rõ hơn và thử lại.',
        422,
        ERROR_CODES.LEARNING_GRAPH_INVALID
      );
    }

    const pathSnapshot = this.pathEngine.buildSnapshot({
      concepts: validatedGraph.concepts.map((concept: DraftConcept) => ({
        id: concept.tempId,
        difficulty: concept.difficulty,
      })),
      masteryByConceptId: {},
      prerequisiteMap: {},
      nextPathVersion: 1,
    });

    const currentItem = pathSnapshot.items.find((item) => item.pathState === 'current');
    const currentConcept =
      validatedGraph.concepts.find((concept) => concept.tempId === currentItem?.conceptId) ??
      validatedGraph.concepts[0] ??
      null;

    const persistedGraph = await this.sessionService.persistValidatedGraph({
      sessionId: session.id,
      concepts: validatedGraph.concepts,
      edges: validatedGraph.edges,
    });

    const persistedPathItems = pathSnapshot.items
      .map((item) => {
        const conceptId = persistedGraph.conceptIdByTempId.get(item.conceptId);
        if (!conceptId) {
          return null;
        }

        return {
          conceptId,
          position: item.position,
          pathState: item.pathState,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const persistedCurrentConceptId = currentConcept
      ? persistedGraph.conceptIdByTempId.get(currentConcept.tempId) ?? null
      : null;

    if (persistedPathItems.length === 0 || persistedCurrentConceptId === null) {
      logger.error('Learning graph persistence produced no current concept', {
        sessionId: session.id,
        conceptCount: validatedGraph.concepts.length,
        persistedPathItemCount: persistedPathItems.length,
      });
      throw new AppError(
        'Không thể khởi tạo trạng thái phiên học. Hãy thử lại với nội dung khác.',
        500,
        ERROR_CODES.LEARNING_GRAPH_INVALID
      );
    }

    await this.sessionService.persistPathSnapshot({
      sessionId: session.id,
      pathVersion: pathSnapshot.pathVersion,
      items: persistedPathItems,
    });

    await this.sessionService.markSessionReady({
      sessionId: session.id,
      currentConceptId: persistedCurrentConceptId,
    });

    return {
      session: {
        id: session.id,
        userId: session.user_id,
        goalTitle: session.goal_title,
        sourceTopic: session.source_topic,
        sourceText: session.source_text,
        status: 'ready' as const,
        currentConceptId: persistedCurrentConceptId,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      pathSnapshot: persistedPathItems.map((item) => ({
        id: crypto.randomUUID(),
        sessionId: session.id,
        conceptId: item.conceptId,
        pathVersion: pathSnapshot.pathVersion,
        position: item.position,
        pathState: item.pathState,
        isCurrent: item.pathState === 'current',
        supersededAt: null,
        createdAt: session.created_at,
      })),
      currentConcept: currentConcept
        ? {
            id: persistedCurrentConceptId ?? currentConcept.tempId,
            sessionId: session.id,
            canonicalName: currentConcept.canonicalName,
            displayName: currentConcept.displayName,
            description: currentConcept.description,
            difficulty: currentConcept.difficulty,
            createdAt: session.created_at,
            updatedAt: session.updated_at,
          }
        : null,
    };
  }

  async submitQuiz(input: {
    userId: string;
    sessionId: string;
    conceptId: string;
    quizId: string;
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    await this.assertSessionAccess(input.userId, input.sessionId);

    const graph = await this.sessionService.getGraph(input.sessionId);
    const prerequisiteMap = this.buildPrerequisiteMap(graph.edges);

    const { persistedMastery, persistedPathSnapshot, currentConceptId, graded } =
      await this.sessionService.withTransaction(
      async (client) => {
        await this.sessionService.lockSession(input.sessionId, client);

        const quizRecord = await this.sessionService.findQuizById(
          input.sessionId,
          input.conceptId,
          input.quizId,
          client
        );
        if (!quizRecord) {
          throw new AppError(
            'Không tìm thấy quiz đang hoạt động cho khái niệm này.',
            404,
            ERROR_CODES.ACTIVE_QUIZ_NOT_FOUND
          );
        }

        if (quizRecord.status === 'submitted') {
          throw new AppError('Quiz này đã được nộp trước đó.', 409, ERROR_CODES.QUIZ_ALREADY_SUBMITTED);
        }

        if (quizRecord.status !== 'active') {
          throw new AppError(
            'Quiz hiện tại không còn khả dụng để chấm điểm.',
            404,
            ERROR_CODES.ACTIVE_QUIZ_NOT_FOUND
          );
        }

        const persistedQuiz = this.resolvePersistedQuizOrThrow(quizRecord.quizPayload);
        const gradedAttempt = this.quizService.grade({
          quiz: persistedQuiz,
          answers: input.answers,
        });
        const previousAttemptScores = await this.sessionService.listQuizAttemptScores(
          input.sessionId,
          input.conceptId,
          client
        );
        const mastery = this.masteryService.calculateNext({
          previousAttemptScores,
          quizScore: gradedAttempt.score,
        });

        const markedSubmitted = await this.sessionService.markQuizSubmitted(
          {
            quizId: input.quizId,
          },
          client
        );
        if (!markedSubmitted) {
          throw new AppError('Quiz này đã được nộp trước đó.', 409, ERROR_CODES.QUIZ_ALREADY_SUBMITTED);
        }

        await this.sessionService.insertQuizAttempt(
          {
            quizId: input.quizId,
            sessionId: input.sessionId,
            conceptId: input.conceptId,
            userAnswers: input.answers,
            score: gradedAttempt.score,
            resultSummary: {
              correctCount: gradedAttempt.correctCount,
              totalQuestions: gradedAttempt.totalQuestions,
              feedback: gradedAttempt.feedback,
            },
          },
          client
        );

        const persistedMasteryRecord = await this.sessionService.upsertConceptMastery(
          {
            sessionId: input.sessionId,
            conceptId: input.conceptId,
            masteryScore: mastery.masteryScore,
            lastQuizScore: mastery.lastQuizScore,
            attemptCount: mastery.attemptCount,
          },
          client
        );

        const masteryRecords = await this.sessionService.listConceptMasteries(input.sessionId, client);
        const masteryByConceptId = Object.fromEntries(
          masteryRecords.map((record) => [record.conceptId, { masteryScore: record.masteryScore }])
        ) as Record<string, { masteryScore: number }>;
        const nextPathVersion = await this.sessionService.getNextPathVersion(input.sessionId, client);
        const pathSnapshotDraft = this.pathEngine.buildSnapshot({
          concepts: graph.concepts.map((concept) => ({
            id: concept.id,
            difficulty: concept.difficulty,
          })),
          masteryByConceptId,
          prerequisiteMap,
          nextPathVersion,
        });
        const currentConceptId = this.pathEngine.getCurrentConceptId(pathSnapshotDraft);
        const persistedPathItems = await this.sessionService.replaceCurrentPathSnapshot(
          {
            sessionId: input.sessionId,
            pathVersion: pathSnapshotDraft.pathVersion,
            currentConceptId,
            items: pathSnapshotDraft.items,
          },
          client
        );

        return {
          graded: gradedAttempt,
          persistedMastery: persistedMasteryRecord,
          persistedPathSnapshot: persistedPathItems,
          currentConceptId,
        };
      }
    );

    return {
      score: graded.score,
      feedback: graded.feedback,
      mastery: persistedMastery,
      pathSnapshot: persistedPathSnapshot,
      nextConcept: graph.concepts.find((concept) => concept.id === currentConceptId) ?? null,
    };
  }

  async getSessionLibrary(input: { userId: string }) {
    const sessions = (await this.sessionService.listSessionLibraryItemsForUser(input.userId)).sort(
      (left, right) => Date.parse(right.session.updatedAt) - Date.parse(left.session.updatedAt)
    );

    return {
      sessions,
      spotlightSession: sessions[0] ?? null,
    };
  }

  async getSessionOverview(input: { userId: string; sessionId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    return this.sessionService.getSessionOverview(input.sessionId);
  }

  async getConceptLearning(input: { userId: string; sessionId: string; conceptId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    const payload = await this.sessionService.getConceptLearningPayload(input.sessionId, input.conceptId);
    const { session, ...conceptPayload } = payload;

    if (!conceptPayload.concept) {
      throw new AppError('Không tìm thấy khái niệm trong phiên học.', 404, ERROR_CODES.NOT_FOUND);
    }

    const lessonPackage = await this.lessonPackageService.getOrCreateCurrentLessonPackage({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      conceptName: conceptPayload.concept.displayName,
      conceptDescription: conceptPayload.concept.description,
      sourceText: session?.sourceText ?? null,
      masteryScore: conceptPayload.mastery?.masteryScore ?? 0,
      prerequisites: conceptPayload.prerequisites.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        description: item.description,
      })),
    });

    return {
      ...conceptPayload,
      lessonPackage,
      quiz: null,
      recap: null,
    };
  }

  async generateExplanation(input: { userId: string; sessionId: string; conceptId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    const payload = await this.sessionService.getConceptLearningPayload(input.sessionId, input.conceptId);
    const explanation = await this.tutorService.generateExplanation({
      conceptName: payload.concept?.displayName ?? 'Khái niệm hiện tại',
      conceptDescription: payload.concept?.description ?? '',
      masteryScore: payload.mastery?.masteryScore ?? 0,
      missingPrerequisites: payload.prerequisites.map((item) => item.displayName),
    });

    return {
      conceptId: input.conceptId,
      explanation,
    };
  }

  async getOrCreateQuiz(input: { userId: string; sessionId: string; conceptId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    const payload = await this.sessionService.getConceptLearningPayload(input.sessionId, input.conceptId);
    const { session, ...conceptPayload } = payload;

    if (!conceptPayload.concept) {
      throw new AppError('Không tìm thấy khái niệm trong phiên học.', 404, ERROR_CODES.NOT_FOUND);
    }

    const lessonPackage = await this.lessonPackageService.getOrCreateCurrentLessonPackage({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      conceptName: conceptPayload.concept.displayName,
      conceptDescription: conceptPayload.concept.description,
      sourceText: session?.sourceText ?? null,
      masteryScore: conceptPayload.mastery?.masteryScore ?? 0,
      prerequisites: conceptPayload.prerequisites.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        description: item.description,
      })),
    });

    const activeQuizRecord = await this.sessionService.getActiveQuiz(input.sessionId, input.conceptId);
    if (activeQuizRecord?.quizPayload) {
      const persistedQuiz = this.quizService.parseStoredQuizPayload(activeQuizRecord.quizPayload);

      if (persistedQuiz?.lessonVersion === lessonPackage.version) {
        return {
          quiz: this.quizService.toClientQuiz(persistedQuiz),
        };
      }

      await this.sessionService.expireActiveQuiz({
        sessionId: input.sessionId,
        conceptId: input.conceptId,
      });
    }

    const quizArtifact = this.quizService.buildQuizFromLesson({
      quizId: crypto.randomUUID(),
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      conceptName: conceptPayload.concept.displayName,
      lessonPackage,
    });

    const inserted = await this.sessionService.insertActiveQuiz({
      quiz: quizArtifact,
    });

    if (!inserted) {
      const persistedQuiz = await this.sessionService.getActiveQuiz(input.sessionId, input.conceptId);
      if (persistedQuiz?.quizPayload) {
        const parsedQuiz = this.resolvePersistedQuizOrThrow(persistedQuiz.quizPayload);
        return {
          quiz: this.quizService.toClientQuiz(parsedQuiz),
        };
      }
    }

    return {
      quiz: this.quizService.toClientQuiz(quizArtifact),
    };
  }

  async getGraph(input: { userId: string; sessionId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    return this.sessionService.getGraph(input.sessionId);
  }

  async askVoiceTutor(input: {
    userId: string;
    sessionId: string;
    conceptId: string;
    learnerUtterance: string;
  }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    const payload = await this.getConceptLearning(input);
    const previousSummaryRecord = await this.sessionService.getLatestVoiceSummary(
      input.sessionId,
      input.conceptId,
      payload.lessonPackage.version
    );
    const reply = await this.voiceTutorService.reply({
      conceptName: payload.concept.displayName,
      lessonPackage: payload.lessonPackage,
      prerequisiteNames: payload.prerequisites.map((item) => item.displayName),
      priorSummary: previousSummaryRecord?.summary ?? null,
      learnerUtterance: input.learnerUtterance,
    });
    const summaryVersion = await this.sessionService.insertVoiceSummary({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      lessonVersion: payload.lessonPackage.version,
      summary: reply.summary,
    });

    return {
      replyText: reply.replyText,
      summaryVersion,
    };
  }
}
