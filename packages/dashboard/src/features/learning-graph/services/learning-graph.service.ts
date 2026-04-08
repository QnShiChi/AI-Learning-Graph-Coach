import { apiClient } from '../../../lib/api/client';
import type {
  CreateLearningSessionRequestSchema,
  CreateLearningSessionResponseSchema,
  GenerateConceptExplanationResponseSchema,
  GetConceptLearningResponseSchema,
  GetConceptQuizResponseSchema,
  GetLearningGraphResponseSchema,
  GetLearningSessionLibraryResponseSchema,
  GetLearningSessionResponseSchema,
  SubmitConceptQuizRequestSchema,
  SubmitConceptQuizResponseSchema,
} from '@insforge/shared-schemas';

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
  ): Promise<GetConceptLearningResponseSchema> {
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

  async getOrCreateQuiz(sessionId: string, conceptId: string): Promise<GetConceptQuizResponseSchema> {
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
}

export const learningGraphService = new LearningGraphService();
