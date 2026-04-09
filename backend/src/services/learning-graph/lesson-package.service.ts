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

    if (currentLessonPackage) {
      return lessonPackageSchema.parse(currentLessonPackage);
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
