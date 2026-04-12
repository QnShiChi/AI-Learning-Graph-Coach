import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonWarmupService } from '@/services/learning-graph/lesson-warmup.service.js';
import { LessonPackageService } from '@/services/learning-graph/lesson-package.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';

describe('LessonWarmupService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('builds a warmup plan from the persisted path snapshot order', async () => {
    vi.spyOn(SessionService.prototype, 'getCurrentPathSnapshot').mockResolvedValue([
      {
        id: 'path-1',
        sessionId: 'session-1',
        conceptId: 'c1',
        pathVersion: 1,
        position: 0,
        pathState: 'current',
        isCurrent: true,
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'path-2',
        sessionId: 'session-1',
        conceptId: 'c2',
        pathVersion: 1,
        position: 1,
        pathState: 'next',
        isCurrent: true,
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'path-3',
        sessionId: 'session-1',
        conceptId: 'c3',
        pathVersion: 1,
        position: 2,
        pathState: 'upcoming',
        isCurrent: true,
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'path-4',
        sessionId: 'session-1',
        conceptId: 'c4',
        pathVersion: 1,
        position: 3,
        pathState: 'upcoming',
        isCurrent: true,
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'path-5',
        sessionId: 'session-1',
        conceptId: 'c5',
        pathVersion: 1,
        position: 4,
        pathState: 'upcoming',
        isCurrent: true,
        supersededAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const service = new LessonWarmupService();
    const plan = await service.buildWarmupPlan('session-1');

    expect(plan).toEqual({
      initialConceptIds: ['c1', 'c2', 'c3'],
      backgroundConceptIds: ['c4', 'c5'],
    });
  });

  it('warms concepts sequentially and skips concepts that already have a ready lesson package', async () => {
    vi.spyOn(LessonPackageService.prototype, 'hasCurrentReadyLessonPackage')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.spyOn(SessionService.prototype, 'findSessionById').mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      goal_title: 'Kinh te hoc',
      source_topic: 'Kinh te hoc',
      source_text: 'Cau va cung',
      status: 'ready',
      current_concept_id: 'c1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findConceptById').mockResolvedValue({
      id: 'c2',
      session_id: 'session-1',
      canonical_name: 'supply',
      display_name: 'Cung',
      description: 'Cung la luong hang nguoi ban san sang ban.',
      difficulty: 0.2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'getConceptMastery').mockResolvedValue(null);
    vi.spyOn(SessionService.prototype, 'listPrerequisites').mockResolvedValue([]);
    const getOrCreateCurrentLessonPackage = vi
      .spyOn(LessonPackageService.prototype, 'getOrCreateCurrentLessonPackage')
      .mockResolvedValue({
        version: 1,
        formatVersion: 2,
        contentQuality: 'validated',
        regenerationReason: 'initial',
        grounding: {
          sourceExcerpt: 'Cung la luong hang nguoi ban san sang ban.',
          sourceHighlights: ['Cung la luong hang nguoi ban san sang ban.'],
          quality: 'concept_specific',
        },
        mainLesson: {
          definition: 'Cung la luong hang nguoi ban san sang ban.',
          importance: 'Giup hieu phan ung cua nguoi ban truoc thay doi gia.',
          corePoints: ['Cung gan voi muc gia.', 'Gia tang thuong lam luong cung tang.'],
          technicalExample: 'Khi gia xoai tang, nhieu nha vuon ban ra nhieu hon.',
          commonMisconceptions: ['Cung khong chi la kha nang san xuat.'],
        },
        prerequisiteMiniLessons: [],
      });

    const service = new LessonWarmupService();
    await service.warmConcepts({
      sessionId: 'session-1',
      conceptIds: ['c1', 'c2'],
    });

    expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledTimes(1);
    expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      conceptId: 'c2',
      conceptName: 'Cung',
      conceptDescription: 'Cung la luong hang nguoi ban san sang ban.',
      sourceText: 'Cau va cung',
      masteryScore: 0,
      prerequisites: [],
    });
  });

  it('schedules background warmup sequentially and continues after a concept fails', async () => {
    vi.useFakeTimers();

    vi.spyOn(LessonPackageService.prototype, 'hasCurrentReadyLessonPackage').mockResolvedValue(false);
    vi.spyOn(SessionService.prototype, 'findSessionById').mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      goal_title: 'Kinh te hoc',
      source_topic: 'Kinh te hoc',
      source_text: 'Cau va cung',
      status: 'ready',
      current_concept_id: 'c1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(SessionService.prototype, 'findConceptById').mockImplementation(async (_sessionId, conceptId) => ({
      id: conceptId,
      session_id: 'session-1',
      canonical_name: conceptId,
      display_name: conceptId.toUpperCase(),
      description: `Description for ${conceptId}`,
      difficulty: 0.2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    vi.spyOn(SessionService.prototype, 'getConceptMastery').mockResolvedValue(null);
    vi.spyOn(SessionService.prototype, 'listPrerequisites').mockResolvedValue([]);
    const getOrCreateCurrentLessonPackage = vi
      .spyOn(LessonPackageService.prototype, 'getOrCreateCurrentLessonPackage')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        version: 1,
        formatVersion: 2,
        contentQuality: 'validated',
        regenerationReason: 'initial',
        grounding: {
          sourceExcerpt: 'ok',
          sourceHighlights: ['ok'],
          quality: 'concept_specific',
        },
        mainLesson: {
          definition: 'ok',
          importance: 'Mot cau importance du dai de pass validation.',
          corePoints: ['Y 1 du dai de hop le.', 'Y 2 du dai de hop le.'],
          technicalExample: 'Vi du ro rang theo ngu canh.',
          commonMisconceptions: [],
        },
        prerequisiteMiniLessons: [],
      });

    const service = new LessonWarmupService();
    service.scheduleConcepts({
      sessionId: 'session-1',
      conceptIds: ['c1', 'c2'],
    });

    await vi.runAllTimersAsync();

    expect(getOrCreateCurrentLessonPackage).toHaveBeenCalledTimes(2);
    expect(getOrCreateCurrentLessonPackage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ conceptId: 'c1' })
    );
    expect(getOrCreateCurrentLessonPackage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ conceptId: 'c2' })
    );
  });
});
