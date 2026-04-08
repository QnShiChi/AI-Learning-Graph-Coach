import { describe, expect, it, vi, afterEach } from 'vitest';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { GraphGenerationService } from '@/services/learning-graph/graph-generation.service.js';
import { TutorService } from '@/services/learning-graph/tutor.service.js';
import { QuizService } from '@/services/learning-graph/quiz.service.js';

describe('LearningOrchestratorService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session, persists the first path snapshot, and returns the current concept', async () => {
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
  });

  it('submits a quiz atomically and returns a refreshed path snapshot', async () => {
    const service = new LearningOrchestratorService();
    const result = await service.submitQuiz({
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      quizId: '44444444-4444-4444-4444-444444444444',
      answers: [{ questionId: 'q1', selectedOptionId: 'a' }],
    });

    expect(result.pathSnapshot.some((item) => item.pathVersion > 1)).toBe(true);
    expect(result.mastery.attemptCount).toBeGreaterThan(0);
  });

  it('loads concept detail, explanation, quiz, and graph payloads for the dashboard', async () => {
    vi.spyOn(SessionService.prototype, 'getConceptLearningPayload').mockResolvedValue({
      concept: {
        id: '66666666-6666-6666-6666-666666666666',
        sessionId: '55555555-5555-5555-5555-555555555555',
        canonicalName: 'backpropagation',
        displayName: 'Backpropagation',
        description: 'desc',
        difficulty: 0.3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      mastery: {
        sessionId: '55555555-5555-5555-5555-555555555555',
        conceptId: '66666666-6666-6666-6666-666666666666',
        masteryScore: 0.2,
        lastQuizScore: 0.2,
        attemptCount: 1,
        updatedAt: new Date().toISOString(),
      },
      prerequisites: [],
    });
    vi.spyOn(TutorService.prototype, 'generateExplanation').mockResolvedValue(
      'Giai thich bang tieng Viet'
    );
    vi.spyOn(QuizService.prototype, 'getOrCreateActiveQuiz').mockResolvedValue({
      id: '77777777-7777-7777-7777-777777777777',
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      status: 'active',
      questions: [
        {
          id: 'q1',
          prompt: 'Backpropagation co vai tro gi?',
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [],
      edges: [],
    });

    const service = new LearningOrchestratorService();
    const explanation = await service.generateExplanation({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
    });
    const quiz = await service.getOrCreateQuiz({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
    });
    const graph = await service.getGraph({
      sessionId: '55555555-5555-5555-5555-555555555555',
    });

    expect(explanation.explanation.length).toBeGreaterThan(0);
    expect(quiz.quiz.status).toBe('active');
    expect(Array.isArray(graph.concepts)).toBe(true);
  });
});
