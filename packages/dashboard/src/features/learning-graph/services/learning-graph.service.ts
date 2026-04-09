import { apiClient } from '../../../lib/api/client';
import type {
  ConceptQuizSchema,
  SessionConceptMasterySchema,
  SessionConceptSchema,
  CreateLearningSessionRequestSchema,
  CreateLearningSessionResponseSchema,
  GenerateConceptExplanationResponseSchema,
  GetConceptQuizResponseSchema,
  GetLearningGraphResponseSchema,
  GetLearningSessionLibraryResponseSchema,
  GetLearningSessionResponseSchema,
  SubmitConceptQuizRequestSchema,
  SubmitConceptQuizResponseSchema,
} from '@insforge/shared-schemas';

export interface LessonPackagePayload {
  version: number;
  regenerationReason: 'initial' | 'failed_quiz' | 'simpler_reexplain' | 'prerequisite_refresh';
  feynmanExplanation: string;
  metaphorImage: {
    imageUrl: string;
    prompt: string;
  };
  imageMapping: Array<{
    visualElement: string;
    everydayMeaning: string;
    technicalMeaning: string;
    teachingPurpose: string;
  }>;
  imageReadingText: string;
  technicalTranslation: string;
  prerequisiteMiniLessons: Array<{
    prerequisiteConceptId: string;
    title: string;
    content: string;
  }>;
}

export interface ConceptRecapPayload {
  summary: string;
  whyPassed: string;
}

export interface ConceptLearningPayload {
  concept: SessionConceptSchema;
  mastery: SessionConceptMasterySchema | null;
  prerequisites: SessionConceptSchema[];
  lessonPackage: LessonPackagePayload;
  quiz: ConceptQuizSchema | null;
  recap: ConceptRecapPayload | null;
}

export interface VoiceTutorReplyPayload {
  replyText: string;
  summaryVersion: number;
}

export class LearningGraphService {
  async createSession(
    input: CreateLearningSessionRequestSchema
  ): Promise<CreateLearningSessionResponseSchema> {
    return apiClient.request('/learning-sessions', {
      method: 'POST',
      headers: apiClient.withAccessToken(),
      body: JSON.stringify(input),
    });
  }

  async getSessionOverview(sessionId: string): Promise<GetLearningSessionResponseSchema> {
    return apiClient.request(`/learning-sessions/${sessionId}`, {
      headers: apiClient.withAccessToken(),
    });
  }

  async listSessions(): Promise<GetLearningSessionLibraryResponseSchema> {
    return apiClient.request('/learning-sessions', {
      headers: apiClient.withAccessToken(),
    });
  }

  async getConceptLearning(
    sessionId: string,
    conceptId: string
  ): Promise<ConceptLearningPayload> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}`, {
      headers: apiClient.withAccessToken(),
    });
  }

  async generateExplanation(
    sessionId: string,
    conceptId: string
  ): Promise<GenerateConceptExplanationResponseSchema> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/explanation`, {
      method: 'POST',
      headers: apiClient.withAccessToken(),
    });
  }

  async revealQuiz(sessionId: string, conceptId: string): Promise<GetConceptQuizResponseSchema> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/quiz`, {
      method: 'POST',
      headers: apiClient.withAccessToken(),
    });
  }

  async submitQuiz(
    sessionId: string,
    conceptId: string,
    input: SubmitConceptQuizRequestSchema
  ): Promise<SubmitConceptQuizResponseSchema> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/quiz-submissions`, {
      method: 'POST',
      headers: apiClient.withAccessToken(),
      body: JSON.stringify(input),
    });
  }

  async getGraph(sessionId: string): Promise<GetLearningGraphResponseSchema> {
    return apiClient.request(`/learning-sessions/${sessionId}/graph`, {
      headers: apiClient.withAccessToken(),
    });
  }

  async askVoiceTutor(
    sessionId: string,
    conceptId: string,
    learnerUtterance: string
  ): Promise<VoiceTutorReplyPayload> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/voice-sandbox`, {
      method: 'POST',
      headers: apiClient.withAccessToken(),
      body: JSON.stringify({ learnerUtterance }),
    });
  }
}

export const learningGraphService = new LearningGraphService();
