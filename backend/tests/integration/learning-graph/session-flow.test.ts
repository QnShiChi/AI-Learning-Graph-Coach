import { describe, expect, it, vi, afterEach } from 'vitest';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { GraphGenerationService } from '@/services/learning-graph/graph-generation.service.js';

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
});
