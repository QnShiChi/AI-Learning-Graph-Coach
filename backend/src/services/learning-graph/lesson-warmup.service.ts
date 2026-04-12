import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import logger from '@/utils/logger.js';
import { LessonPackageService } from './lesson-package.service.js';
import { SessionService } from './session.service.js';

interface ScheduledConceptWarmup {
  sessionId: string;
  conceptId: string;
}

export class LessonWarmupService {
  static readonly DEFAULT_WARMUP_COUNT = 3;

  private queue: ScheduledConceptWarmup[] = [];
  private processing = false;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private sessionService = new SessionService(),
    private lessonPackageService = new LessonPackageService()
  ) {}

  async buildWarmupPlan(
    sessionId: string,
    warmupCount = LessonWarmupService.DEFAULT_WARMUP_COUNT
  ) {
    const pathSnapshot = await this.sessionService.getCurrentPathSnapshot(sessionId);
    const orderedConceptIds = [...pathSnapshot]
      .sort((left, right) => left.position - right.position)
      .map((item) => item.conceptId);

    return {
      initialConceptIds: orderedConceptIds.slice(0, warmupCount),
      backgroundConceptIds: orderedConceptIds.slice(warmupCount),
    };
  }

  async warmConcepts(input: { sessionId: string; conceptIds: string[] }) {
    for (const conceptId of input.conceptIds) {
      if (await this.lessonPackageService.hasCurrentReadyLessonPackage(input.sessionId, conceptId)) {
        continue;
      }

      const session = await this.sessionService.findSessionById(input.sessionId);
      const concept = await this.sessionService.findConceptById(input.sessionId, conceptId);

      if (!session || !concept) {
        throw new AppError(
          'Không thể chuẩn bị lesson package cho concept hiện tại.',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const mastery = await this.sessionService.getConceptMastery(input.sessionId, conceptId);
      const prerequisites = await this.sessionService.listPrerequisites(input.sessionId, conceptId);

      await this.lessonPackageService.getOrCreateCurrentLessonPackage({
        sessionId: input.sessionId,
        conceptId,
        conceptName: concept.display_name,
        conceptDescription: concept.description,
        sourceText: session.source_text,
        masteryScore: mastery?.masteryScore ?? 0,
        prerequisites: prerequisites.map((item) => ({
          id: item.id,
          displayName: item.display_name,
          description: item.description,
        })),
      });
    }
  }

  scheduleConcepts(input: { sessionId: string; conceptIds: string[] }) {
    for (const conceptId of input.conceptIds) {
      this.queue.push({
        sessionId: input.sessionId,
        conceptId,
      });
    }

    if (this.processing || this.drainTimer || this.queue.length === 0) {
      return;
    }

    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drainQueue();
    }, 0);
  }

  private async drainQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();

        if (!next) {
          continue;
        }

        try {
          await this.warmConcepts({
            sessionId: next.sessionId,
            conceptIds: [next.conceptId],
          });
        } catch (error) {
          logger.warn('Learning graph background lesson warmup failed', {
            sessionId: next.sessionId,
            conceptId: next.conceptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
