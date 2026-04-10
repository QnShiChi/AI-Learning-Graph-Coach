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

  private isLegacyLessonPackage(lessonPackage: LessonPackageSchema) {
    return (
      lessonPackage.feynmanExplanation.includes('chỗ sai') ||
      lessonPackage.feynmanExplanation.includes('lần ngược') ||
      lessonPackage.imageReadingText.includes('sửa lỗi từng bước') ||
      lessonPackage.metaphorImage.imageUrl.includes('example.com/learning-graph') ||
      lessonPackage.technicalTranslation.includes('Nguồn học tập hiện tại nhấn mạnh:')
    );
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

    if (currentLessonPackage) {
      const parsedCurrentLessonPackage = lessonPackageSchema.parse(currentLessonPackage);

      if (!this.isLegacyLessonPackage(parsedCurrentLessonPackage)) {
        return parsedCurrentLessonPackage;
      }

      const regeneratedLessonPackage = lessonPackageSchema.parse(
        await this.tutorService.generateLessonPackage({
          conceptName: input.conceptName,
          conceptDescription: input.conceptDescription,
          sourceText: input.sourceText,
          masteryScore: input.masteryScore,
          missingPrerequisites: input.prerequisites,
          regenerationReason: 'simpler_reexplain',
          version: parsedCurrentLessonPackage.version + 1,
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
