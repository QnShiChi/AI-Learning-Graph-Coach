import { lessonPackageSchema, type LessonPackageSchema } from '@insforge/shared-schemas';
import { SessionService } from './session.service.js';
import { TutorService } from './tutor.service.js';

interface LessonPackagePrerequisiteInput {
  id: string;
  displayName: string;
  description: string;
}

export class LessonPackageService {
  private sessionService = new SessionService();
  private tutorService = new TutorService();

  private isAcademicLessonPackage(value: unknown): value is LessonPackageSchema {
    return lessonPackageSchema.safeParse(value).success;
  }

  private resolveNextVersion(value: unknown) {
    if (!value || typeof value !== 'object' || !('version' in value)) {
      return 1;
    }

    const version = Number((value as { version?: unknown }).version ?? 1);
    return Number.isFinite(version) && version >= 1 ? version + 1 : 1;
  }

  async getOrCreateCurrentLessonPackage(input: {
    sessionId: string;
    conceptId: string;
    conceptName: string;
    conceptDescription: string;
    sourceText: string | null;
    masteryScore: number;
    prerequisites: LessonPackagePrerequisiteInput[];
  }): Promise<LessonPackageSchema> {
    const currentLessonPackage = await this.sessionService.getCurrentLessonPackage(
      input.sessionId,
      input.conceptId
    );

    if (this.isAcademicLessonPackage(currentLessonPackage)) {
      return currentLessonPackage;
    }

    if (currentLessonPackage) {
      const regeneratedLessonPackage = lessonPackageSchema.parse(
        await this.tutorService.generateLessonPackage({
          conceptName: input.conceptName,
          conceptDescription: input.conceptDescription,
          sourceText: input.sourceText,
          masteryScore: input.masteryScore,
          missingPrerequisites: input.prerequisites,
          regenerationReason: 'academic_redesign',
          version: this.resolveNextVersion(currentLessonPackage),
        })
      );

      const insertedRegeneratedLessonPackage = await this.sessionService.insertLessonPackage({
        sessionId: input.sessionId,
        conceptId: input.conceptId,
        lessonPackage: regeneratedLessonPackage,
      });

      if (!insertedRegeneratedLessonPackage) {
        const persistedRegeneratedLessonPackage = await this.sessionService.getCurrentLessonPackage(
          input.sessionId,
          input.conceptId
        );

        if (persistedRegeneratedLessonPackage) {
          return lessonPackageSchema.parse(persistedRegeneratedLessonPackage);
        }
      }

      return regeneratedLessonPackage;
    }

    const generatedLessonPackage = lessonPackageSchema.parse(
      await this.tutorService.generateLessonPackage({
        conceptName: input.conceptName,
        conceptDescription: input.conceptDescription,
        sourceText: input.sourceText,
        masteryScore: input.masteryScore,
        missingPrerequisites: input.prerequisites,
        regenerationReason: 'initial',
      })
    );

    const inserted = await this.sessionService.insertLessonPackage({
      sessionId: input.sessionId,
      conceptId: input.conceptId,
      lessonPackage: generatedLessonPackage,
    });

    if (!inserted) {
      const persistedLessonPackage = await this.sessionService.getCurrentLessonPackage(
        input.sessionId,
        input.conceptId
      );

      if (persistedLessonPackage) {
        return persistedLessonPackage;
      }
    }

    return generatedLessonPackage;
  }
}
