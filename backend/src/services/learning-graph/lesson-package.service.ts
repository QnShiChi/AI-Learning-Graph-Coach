import { lessonPackageSchema, type LessonPackageSchema } from '@insforge/shared-schemas';
import { ConceptGroundingService } from './concept-grounding.service.js';
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
  private conceptGroundingService = new ConceptGroundingService();

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeLessonText(value: string) {
    return value
      .replace(/^\s*(?:[-*•]+|\d+[.)]?|[A-Za-z][.)])\s*/u, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isAcademicLessonPackage(value: unknown): value is LessonPackageSchema {
    return lessonPackageSchema.safeParse(value).success;
  }

  private shouldRegenerateLessonPackage(lessonPackage: LessonPackageSchema) {
    const cleanedImportance = this.sanitizeLessonText(lessonPackage.mainLesson.importance);
    const malformedCorePoint = lessonPackage.mainLesson.corePoints.some((corePoint) => {
      const cleanedCorePoint = this.sanitizeLessonText(corePoint);
      const normalizedCorePoint = this.normalize(cleanedCorePoint);

      return !normalizedCorePoint || /^\d+$/.test(normalizedCorePoint) || cleanedCorePoint.length < 18;
    });

    return (
      !this.normalize(cleanedImportance) ||
      /^\d+$/.test(this.normalize(cleanedImportance)) ||
      cleanedImportance.length < 18 ||
      malformedCorePoint
    );
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

    if (
      this.isAcademicLessonPackage(currentLessonPackage) &&
      !this.shouldRegenerateLessonPackage(currentLessonPackage)
    ) {
      return currentLessonPackage;
    }

    const graph = await this.sessionService.getGraph(input.sessionId);
    const siblingConceptNames = graph.concepts
      .filter((concept) => concept.id !== input.conceptId)
      .map((concept) => concept.displayName);

    const grounding = this.conceptGroundingService.extract({
      conceptName: input.conceptName,
      conceptDescription: input.conceptDescription,
      siblingConceptNames,
      sourceText: input.sourceText,
    });

    if (currentLessonPackage) {
      const regeneratedLessonPackage = lessonPackageSchema.parse(
        await this.tutorService.generateLessonPackage({
          conceptName: input.conceptName,
          conceptDescription: input.conceptDescription,
          grounding,
          sourceText: input.sourceText,
          siblingConceptNames,
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
        grounding,
        sourceText: input.sourceText,
        siblingConceptNames,
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
