import { apiClient } from '../../../lib/api/client';
import type {
  ConceptQuizSchema,
  CreateVoiceTurnRequestSchema,
  CreateVoiceTurnResponseSchema,
  CreateLearningSessionRequestSchema,
  CreateLearningSessionResponseSchema,
  GenerateConceptExplanationResponseSchema,
  GetConceptQuizResponseSchema,
  GetLearningGraphResponseSchema,
  GetVoiceHistoryResponseSchema,
  GetLearningSessionLibraryResponseSchema,
  GetLearningSessionResponseSchema,
  SessionConceptMasterySchema,
  SessionConceptSchema,
  SubmitConceptQuizRequestSchema,
  SubmitConceptQuizResponseSchema,
  VoiceHistoryTurnSchema,
  VoiceTutorAudioSchema,
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
  explanation: string | null;
  quiz: ConceptQuizSchema | null;
  recap: ConceptRecapPayload | null;
}

export type VoiceTutorAudioPayload = VoiceTutorAudioSchema;
export type VoiceTutorHistoryTurn = VoiceHistoryTurnSchema;
export type VoiceTutorTurnPayload = CreateVoiceTurnResponseSchema;
export type VoiceTutorHistoryPayload = GetVoiceHistoryResponseSchema;

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

  async createVoiceTurn(
    sessionId: string,
    conceptId: string,
    input: CreateVoiceTurnRequestSchema
  ): Promise<VoiceTutorTurnPayload> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/voice-turns`, {
      method: 'POST',
      headers: apiClient.withAccessToken(),
      body: JSON.stringify(input),
    });
  }

  async getVoiceHistory(
    sessionId: string,
    conceptId: string
  ): Promise<VoiceTutorHistoryPayload> {
    return apiClient.request(`/learning-sessions/${sessionId}/concepts/${conceptId}/voice-history`, {
      headers: apiClient.withAccessToken(),
    });
  }
}

export const learningGraphService = new LearningGraphService();
