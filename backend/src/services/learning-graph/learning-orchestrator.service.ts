import { GraphGenerationService } from './graph-generation.service.js';
import { GraphValidationService, type DraftConcept } from './graph-validation.service.js';
import { InputNormalizationService } from './input-normalization.service.js';
import { MasteryService } from './mastery.service.js';
import { PathEngineService } from './path-engine.service.js';
import { QuizService } from './quiz.service.js';
import { SessionService } from './session.service.js';
import { TutorService } from './tutor.service.js';
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';

export class LearningOrchestratorService {
  private inputNormalization = new InputNormalizationService();
  private graphGeneration = new GraphGenerationService();
  private graphValidation = new GraphValidationService();
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

    return {
      session: {
        ...session,
        status: 'ready' as const,
        current_concept_id: currentConcept?.tempId ?? null,
      },
      pathSnapshot: pathSnapshot.items,
      currentConcept,
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
    return this.sessionService.getConceptLearningPayload(input.sessionId, input.conceptId);
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
