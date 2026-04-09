import { describe, expect, it, vi, afterEach } from 'vitest';
import { AppError } from '@/api/middlewares/error.js';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { GraphGenerationService } from '@/services/learning-graph/graph-generation.service.js';
import { TutorService } from '@/services/learning-graph/tutor.service.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import type { PoolClient } from 'pg';

describe('LearningOrchestratorService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session, persists the first path snapshot, and returns the current concept', async () => {
    const persistGraph = vi
      .spyOn(SessionService.prototype, 'persistValidatedGraph')
      .mockResolvedValue({
        conceptIdByTempId: new Map([
          ['c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
          ['c2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
        ]),
      });
    const persistPath = vi.spyOn(SessionService.prototype, 'persistPathSnapshot').mockResolvedValue();
    const updateStatus = vi
      .spyOn(SessionService.prototype, 'markSessionReady')
      .mockResolvedValue(undefined);

    vi.spyOn(SessionService.prototype, 'createLearningSession').mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '11111111-1111-1111-1111-111111111111',
      goal_title: 'Deep Learning',
      source_topic: 'Deep Learning',
      source_text: 'Backpropagation, chain rule, gradient descent',
      status: 'initializing',
      current_concept_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.spyOn(GraphGenerationService.prototype, 'generate').mockResolvedValue({
      sessionGoal: 'Deep Learning',
      concepts: [
        {
          tempId: 'c1',
          displayName: 'Backpropagation',
          canonicalName: 'backpropagation',
          description: 'desc',
          difficulty: 0.2,
        },
        {
          tempId: 'c2',
          displayName: 'Gradient Descent',
          canonicalName: 'gradient descent',
          description: 'desc',
          difficulty: 0.5,
        },
      ],
      edges: [],
    });

    const service = new LearningOrchestratorService();
    const result = await service.createSession({
      userId: '11111111-1111-1111-1111-111111111111',
      topic: 'Deep Learning',
      sourceText: 'Backpropagation, chain rule, gradient descent',
    });

    expect(result.session.status).toBe('ready');
    expect(result.pathSnapshot[0].pathState).toBe('current');
    expect(result.currentConcept).not.toBeNull();
    expect(persistGraph).toHaveBeenCalledTimes(1);
    expect(persistPath).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith({
      sessionId: '11111111-1111-1111-1111-111111111111',
      currentConceptId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
  });

  it('submits a persisted quiz attempt, updates mastery, and returns a refreshed path snapshot', async () => {
    vi.spyOn(SessionService.prototype, 'findSessionByIdForUser').mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      user_id: '11111111-1111-1111-1111-111111111111',
      goal_title: 'Deep Learning',
      source_topic: 'Deep Learning',
      source_text: 'Backpropagation, chain rule, gradient descent',
      status: 'ready',
      current_concept_id: '33333333-3333-3333-3333-333333333333',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findQuizById').mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      status: 'active',
      quizPayload: {
        id: '44444444-4444-4444-4444-444444444444',
        sessionId: '22222222-2222-2222-2222-222222222222',
        conceptId: '33333333-3333-3333-3333-333333333333',
        lessonVersion: 1,
        status: 'active',
        createdAt: new Date().toISOString(),
        questions: [
          {
            id: 'q1',
            prompt: 'Dau la loi giai thich Feynman?',
            options: [
              { id: 'a', text: 'Lan truyen sai so nguoc qua cac lop', isCorrect: true },
              { id: 'b', text: 'Tai file len storage', isCorrect: false },
            ],
          },
          {
            id: 'q2',
            prompt: 'Dau la ban dich ky thuat?',
            options: [
              { id: 'c', text: 'Tinh gradient de cap nhat tham so', isCorrect: true },
              { id: 'd', text: 'Dang nhap bang OAuth', isCorrect: false },
            ],
          },
        ],
      },
      createdAt: new Date().toISOString(),
      submittedAt: null,
      expiredAt: null,
    });
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          sessionId: '22222222-2222-2222-2222-222222222222',
          canonicalName: 'backpropagation',
          displayName: 'Backpropagation',
          description: 'desc',
          difficulty: 0.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '55555555-5555-5555-5555-555555555555',
          sessionId: '22222222-2222-2222-2222-222222222222',
          canonicalName: 'gradient-descent',
          displayName: 'Gradient Descent',
          description: 'desc',
          difficulty: 0.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      edges: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          sessionId: '22222222-2222-2222-2222-222222222222',
          fromConceptId: '33333333-3333-3333-3333-333333333333',
          toConceptId: '55555555-5555-5555-5555-555555555555',
          edgeType: 'prerequisite',
          weight: 1,
          source: 'validation',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    vi.spyOn(SessionService.prototype, 'listConceptMasteries').mockResolvedValue([
      {
        sessionId: '22222222-2222-2222-2222-222222222222',
        conceptId: '33333333-3333-3333-3333-333333333333',
        masteryScore: 0.9,
        lastQuizScore: 0.9,
        attemptCount: 1,
        updatedAt: new Date().toISOString(),
      },
    ]);
    const lockSession = vi
      .spyOn(SessionService.prototype, 'lockSession')
      .mockResolvedValue(undefined);
    vi.spyOn(SessionService.prototype, 'listQuizAttemptScores').mockResolvedValue([0.9]);
    vi.spyOn(SessionService.prototype, 'getNextPathVersion').mockResolvedValue(2);
    vi.spyOn(SessionService.prototype, 'withTransaction').mockImplementation(async (callback) =>
      callback({ query: vi.fn() } as unknown as PoolClient)
    );
    const markQuizSubmitted = vi
      .spyOn(SessionService.prototype, 'markQuizSubmitted')
      .mockResolvedValue(true);
    const insertQuizAttempt = vi
      .spyOn(SessionService.prototype, 'insertQuizAttempt')
      .mockResolvedValue(undefined);
    const upsertConceptMastery = vi
      .spyOn(SessionService.prototype, 'upsertConceptMastery')
      .mockResolvedValue({
        sessionId: '22222222-2222-2222-2222-222222222222',
        conceptId: '33333333-3333-3333-3333-333333333333',
        masteryScore: 0.95,
        lastQuizScore: 1,
        attemptCount: 2,
        updatedAt: new Date().toISOString(),
      });
    const replaceCurrentPathSnapshot = vi
      .spyOn(SessionService.prototype, 'replaceCurrentPathSnapshot')
      .mockResolvedValue([
        {
          id: '77777777-7777-7777-7777-777777777777',
          sessionId: '22222222-2222-2222-2222-222222222222',
          conceptId: '33333333-3333-3333-3333-333333333333',
          pathVersion: 2,
          position: 0,
          pathState: 'completed',
          isCurrent: true,
          supersededAt: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: '88888888-8888-8888-8888-888888888888',
          sessionId: '22222222-2222-2222-2222-222222222222',
          conceptId: '55555555-5555-5555-5555-555555555555',
          pathVersion: 2,
          position: 1,
          pathState: 'current',
          isCurrent: true,
          supersededAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);

    const service = new LearningOrchestratorService();
    const result = await service.submitQuiz({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      quizId: '44444444-4444-4444-4444-444444444444',
      answers: [
        { questionId: 'q1', selectedOptionId: 'a' },
        { questionId: 'q2', selectedOptionId: 'c' },
      ],
    });

    expect(markQuizSubmitted).toHaveBeenCalledTimes(1);
    expect(lockSession).toHaveBeenCalledTimes(1);
    expect(insertQuizAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId: '44444444-4444-4444-4444-444444444444',
        score: 1,
        resultSummary: expect.objectContaining({
          correctCount: 2,
          totalQuestions: 2,
        }),
      }),
      expect.anything()
    );
    expect(upsertConceptMastery).toHaveBeenCalledWith(
      expect.objectContaining({
        masteryScore: 0.95,
        attemptCount: 2,
      }),
      expect.anything()
    );
    expect(replaceCurrentPathSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        pathVersion: 2,
        currentConceptId: '55555555-5555-5555-5555-555555555555',
      }),
      expect.anything()
    );
    expect(result.score).toBe(1);
    expect(result.mastery.masteryScore).toBe(0.95);
    expect(result.pathSnapshot.some((item) => item.pathVersion === 2)).toBe(true);
    expect(result.nextConcept?.id).toBe('55555555-5555-5555-5555-555555555555');
  });

  it('loads a concept payload with a default lesson package before quiz reveal', async () => {
    vi.spyOn(SessionService.prototype, 'findSessionByIdForUser').mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      user_id: '11111111-1111-1111-1111-111111111111',
      goal_title: 'Deep Learning',
      source_topic: 'Deep Learning',
      source_text: null,
      status: 'ready',
      current_concept_id: '66666666-6666-6666-6666-666666666666',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findSessionById').mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      user_id: '11111111-1111-1111-1111-111111111111',
      goal_title: 'Deep Learning',
      source_topic: 'Deep Learning',
      source_text: 'Backpropagation lan truyền lỗi từ output về hidden layers.',
      status: 'ready',
      current_concept_id: '66666666-6666-6666-6666-666666666666',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findConceptById').mockResolvedValue({
      id: '66666666-6666-6666-6666-666666666666',
      session_id: '55555555-5555-5555-5555-555555555555',
      canonical_name: 'backpropagation',
      display_name: 'Backpropagation',
      description: 'desc',
      difficulty: 0.3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'getConceptMastery').mockResolvedValue({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      masteryScore: 0.2,
      lastQuizScore: 0.2,
      attemptCount: 1,
      updatedAt: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'listPrerequisites').mockResolvedValue([]);
    vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue(null);
    vi.spyOn(SessionService.prototype, 'insertLessonPackage').mockResolvedValue(true);
    vi.spyOn(TutorService.prototype, 'generateExplanation').mockResolvedValue(
      'Giai thich bang tieng Viet'
    );
    vi.spyOn(SessionService.prototype, 'getActiveQuiz').mockResolvedValue(null);
    const insertActiveQuiz = vi
      .spyOn(SessionService.prototype, 'insertActiveQuiz')
      .mockResolvedValue(true);
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [],
      edges: [],
    });

    const service = new LearningOrchestratorService();
    const conceptLearning = await service.getConceptLearning({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
    });
    const explanation = await service.generateExplanation({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
    });
    const quiz = await service.getOrCreateQuiz({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
    });
    const graph = await service.getGraph({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '55555555-5555-5555-5555-555555555555',
    });

    expect(conceptLearning.lessonPackage).toMatchObject({
      version: 1,
      regenerationReason: 'initial',
      feynmanExplanation: expect.any(String),
      metaphorImage: {
        imageUrl: expect.any(String),
        prompt: expect.any(String),
      },
      imageMapping: expect.arrayContaining([
        expect.objectContaining({
          visualElement: expect.any(String),
          everydayMeaning: expect.any(String),
          technicalMeaning: expect.any(String),
          teachingPurpose: expect.any(String),
        }),
      ]),
      imageReadingText: expect.any(String),
      technicalTranslation: expect.any(String),
    });
    expect(conceptLearning.quiz).toBeNull();
    expect(conceptLearning.recap).toBeNull();
    expect(explanation.explanation.length).toBeGreaterThan(0);
    expect(quiz.quiz.status).toBe('active');
    expect(quiz.quiz.questions[0]?.options[0]).not.toHaveProperty('isCorrect');
    expect(insertActiveQuiz).toHaveBeenCalledTimes(1);
    expect(Array.isArray(graph.concepts)).toBe(true);
  });

  it('rejects session creation when graph generation produces no usable concepts', async () => {
    vi.spyOn(SessionService.prototype, 'createLearningSession').mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '11111111-1111-1111-1111-111111111111',
      goal_title: 'Deep Learning',
      source_topic: 'Deep Learning',
      source_text: 'Backpropagation, chain rule, gradient descent',
      status: 'initializing',
      current_concept_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(GraphGenerationService.prototype, 'generate').mockResolvedValue({
      sessionGoal: 'Deep Learning',
      concepts: [],
      edges: [],
    });

    const service = new LearningOrchestratorService();

    await expect(
      service.createSession({
        userId: '11111111-1111-1111-1111-111111111111',
        topic: 'Deep Learning',
        sourceText: 'Backpropagation, chain rule, gradient descent',
      })
    ).rejects.toMatchObject<AppError>({
      code: ERROR_CODES.LEARNING_GRAPH_INVALID,
      statusCode: 422,
    });
  });

  it('returns a most-recent-first session library with a spotlight session', async () => {
    vi.spyOn(SessionService.prototype, 'listSessionLibraryItemsForUser').mockResolvedValue([
      {
        session: {
          id: 'older-session',
          userId: '11111111-1111-1111-1111-111111111111',
          goalTitle: 'Linear Algebra',
          sourceTopic: 'Linear Algebra',
          sourceText: null,
          status: 'ready',
          currentConceptId: 'concept-a',
          createdAt: '2026-04-08T09:00:00.000Z',
          updatedAt: '2026-04-08T09:30:00.000Z',
        },
        progress: { completedCount: 1, totalCount: 4 },
        currentConcept: null,
      },
      {
        session: {
          id: 'newer-session',
          userId: '11111111-1111-1111-1111-111111111111',
          goalTitle: 'Deep Learning',
          sourceTopic: 'Deep Learning',
          sourceText: null,
          status: 'completed',
          currentConceptId: null,
          createdAt: '2026-04-08T10:00:00.000Z',
          updatedAt: '2026-04-08T12:00:00.000Z',
        },
        progress: { completedCount: 5, totalCount: 5 },
        currentConcept: null,
      },
    ]);

    const service = new LearningOrchestratorService();
    const result = await service.getSessionLibrary({
      userId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.sessions.map((item) => item.session.id)).toEqual(['newer-session', 'older-session']);
    expect(result.spotlightSession?.session.id).toBe('newer-session');
  });

  it('rejects session overview reads for sessions outside the current user scope', async () => {
    vi.spyOn(SessionService.prototype, 'findSessionByIdForUser').mockResolvedValue(null);

    const service = new LearningOrchestratorService();

    await expect(
      service.getSessionOverview({
        userId: '11111111-1111-1111-1111-111111111111',
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      })
    ).rejects.toMatchObject<AppError>({
      code: ERROR_CODES.LEARNING_SESSION_NOT_FOUND,
      statusCode: 404,
    });
  });
});
