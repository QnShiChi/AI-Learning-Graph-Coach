import { z } from 'zod';
import {
  conceptQuizSchema,
  learningSessionSchema,
  sessionPathItemSchema,
  sessionConceptSchema,
  sessionConceptMasterySchema,
  sessionEdgeSchema,
} from './learning-graph.schema.js';

export const createLearningSessionRequestSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required'),
  sourceText: z.string().trim().max(20000).optional(),
});

export const submitConceptQuizRequestSchema = z.object({
  quizId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        selectedOptionId: z.string(),
      })
    )
    .min(1),
});

export const getConceptQuizResponseSchema = z.object({
  quiz: conceptQuizSchema,
});

export const createLearningSessionResponseSchema = z.object({
  session: learningSessionSchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  currentConcept: sessionConceptSchema,
  graphSummary: z.object({
    nodeCount: z.number().int().min(0),
    edgeCount: z.number().int().min(0),
  }),
});

export const getLearningSessionResponseSchema = z.object({
  session: learningSessionSchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  progress: z.object({
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
  }),
  currentConcept: sessionConceptSchema.nullable(),
});

export const getConceptLearningResponseSchema = z.object({
  concept: sessionConceptSchema,
  mastery: sessionConceptMasterySchema.nullable(),
  prerequisites: z.array(sessionConceptSchema),
});

export const generateConceptExplanationResponseSchema = z.object({
  conceptId: z.string().uuid(),
  explanation: z.string(),
});

export const submitConceptQuizResponseSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string(),
  mastery: sessionConceptMasterySchema,
  pathSnapshot: z.array(sessionPathItemSchema),
  nextConcept: sessionConceptSchema.nullable(),
});

export const getLearningGraphResponseSchema = z.object({
  concepts: z.array(sessionConceptSchema),
  edges: z.array(sessionEdgeSchema),
});

export type CreateLearningSessionRequestSchema = z.infer<typeof createLearningSessionRequestSchema>;
export type SubmitConceptQuizRequestSchema = z.infer<typeof submitConceptQuizRequestSchema>;
export type GetConceptQuizResponseSchema = z.infer<typeof getConceptQuizResponseSchema>;
export type CreateLearningSessionResponseSchema = z.infer<typeof createLearningSessionResponseSchema>;
export type GetLearningSessionResponseSchema = z.infer<typeof getLearningSessionResponseSchema>;
export type GetConceptLearningResponseSchema = z.infer<typeof getConceptLearningResponseSchema>;
export type GenerateConceptExplanationResponseSchema = z.infer<
  typeof generateConceptExplanationResponseSchema
>;
export type SubmitConceptQuizResponseSchema = z.infer<typeof submitConceptQuizResponseSchema>;
export type GetLearningGraphResponseSchema = z.infer<typeof getLearningGraphResponseSchema>;
