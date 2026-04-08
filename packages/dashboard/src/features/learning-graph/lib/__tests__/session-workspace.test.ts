import { describe, expect, it } from 'vitest';
import {
  getSessionPrimaryHref,
  pickSpotlightSession,
  type LearningSessionLibraryItem,
} from '../session-workspace';

function buildItem(
  id: string,
  status: 'ready' | 'completed',
  updatedAt: string
): LearningSessionLibraryItem {
  return {
    session: {
      id,
      userId: '11111111-1111-1111-1111-111111111111',
      goalTitle: id,
      sourceTopic: id,
      sourceText: null,
      status,
      currentConceptId: status === 'completed' ? null : 'concept-id',
      createdAt: updatedAt,
      updatedAt,
    },
    progress: { completedCount: status === 'completed' ? 3 : 1, totalCount: 3 },
    currentConcept:
      status === 'completed'
        ? null
        : {
            id: 'concept-id',
            sessionId: id,
            canonicalName: 'gradient-descent',
            displayName: 'Gradient Descent',
            description: 'desc',
            difficulty: 0.4,
            createdAt: updatedAt,
            updatedAt,
          },
  };
}

describe('getSessionPrimaryHref', () => {
  it('routes incomplete sessions to the learn route', () => {
    expect(getSessionPrimaryHref(buildItem('ready-session', 'ready', '2026-04-08T12:00:00.000Z'))).toBe(
      '/dashboard/learning-graph/sessions/ready-session/learn'
    );
  });

  it('routes completed sessions to the overview route', () => {
    expect(
      getSessionPrimaryHref(buildItem('completed-session', 'completed', '2026-04-08T12:00:00.000Z'))
    ).toBe('/dashboard/learning-graph/sessions/completed-session/overview');
  });
});

describe('pickSpotlightSession', () => {
  it('returns the most recently updated session', () => {
    const result = pickSpotlightSession([
      buildItem('older', 'ready', '2026-04-08T09:00:00.000Z'),
      buildItem('newer', 'ready', '2026-04-08T12:00:00.000Z'),
    ]);

    expect(result?.session.id).toBe('newer');
  });
});
