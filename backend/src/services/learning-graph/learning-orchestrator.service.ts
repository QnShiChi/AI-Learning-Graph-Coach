import { GraphGenerationService } from './graph-generation.service.js';
import { GraphValidationService, type DraftConcept } from './graph-validation.service.js';
import { InputNormalizationService } from './input-normalization.service.js';
import { LessonPackageService } from './lesson-package.service.js';
import { MasteryService } from './mastery.service.js';
import { PathEngineService } from './path-engine.service.js';
import { QuizService } from './quiz.service.js';
import { SessionService } from './session.service.js';
import { TutorService } from './tutor.service.js';
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import logger from '@/utils/logger.js';

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
    sessionId: string;
    conceptId: string;
    quizId: string;
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }) {
    const graded = this.quizService.grade({
      questions: [
        {
          id: 'q1',
          prompt: 'placeholder',
          options: [
            { id: 'a', text: 'A', isCorrect: true },
            { id: 'b', text: 'B', isCorrect: false },
          ],
        },
      ],
      answers: input.answers,
    });

    const mastery = this.masteryService.calculateNext({
      previousMastery: 0,
      quizScore: graded.score,
      attemptCount: 0,
    });

    return {
      score: graded.score,
      feedback: graded.feedback,
      mastery,
      pathSnapshot: [
        {
          conceptId: input.conceptId,
          position: 0,
          pathState: 'completed' as const,
          pathVersion: 2,
        },
      ],
      nextConcept: null,
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
    const quiz = await this.quizService.getOrCreateActiveQuiz({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      conceptName: payload.concept?.displayName ?? 'Khái niệm hiện tại',
      conceptDescription: payload.concept?.description ?? '',
    });

    return { quiz };
  }

  async getGraph(input: { userId: string; sessionId: string }) {
    await this.assertSessionAccess(input.userId, input.sessionId);
    return this.sessionService.getGraph(input.sessionId);
  }
}
