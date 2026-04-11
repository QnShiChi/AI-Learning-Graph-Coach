import { z } from 'zod';

export const learningSessionStatusSchema = z.enum([
  'initializing',
  'ready',
  'completed',
  'failed',
]);

export const sessionPathStateSchema = z.enum([
  'completed',
  'current',
  'next',
  'upcoming',
  'locked',
]);

export const sessionConceptQuizStatusSchema = z.enum(['active', 'submitted', 'expired']);
export const conceptQuizDifficultySchema = z.enum(['core', 'medium', 'stretch']);
export const conceptQuizSkillTagSchema = z.enum([
  'definition',
  'distinction',
  'analogy',
  'application',
  'misconception',
]);

export const learningSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  goalTitle: z.string(),
  sourceTopic: z.string(),
  sourceText: z.string().nullable(),
  status: learningSessionStatusSchema,
  currentConceptId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionPathItemSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  pathVersion: z.number().int().min(1),
  position: z.number().int().min(0),
  pathState: sessionPathStateSchema,
  isCurrent: z.boolean(),
  supersededAt: z.string().nullable(),
  createdAt: z.string(),
});

export const sessionConceptSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  canonicalName: z.string(),
  displayName: z.string(),
  description: z.string(),
  difficulty: z.number().min(0).max(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionEdgeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  fromConceptId: z.string().uuid(),
  toConceptId: z.string().uuid(),
  edgeType: z.literal('prerequisite'),
  weight: z.number().min(0).max(1),
  source: z.enum(['llm', 'validation']),
  createdAt: z.string(),
});

export const sessionConceptMasterySchema = z.object({
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  masteryScore: z.number().min(0).max(1),
  lastQuizScore: z.number().min(0).max(1),
  attemptCount: z.number().int().min(0),
  updatedAt: z.string(),
});

export const conceptQuizSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  conceptId: z.string().uuid(),
  status: sessionConceptQuizStatusSchema,
  questionCountTarget: z.number().int().min(2).max(4),
  questions: z
    .array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        difficulty: conceptQuizDifficultySchema,
        skillTag: conceptQuizSkillTagSchema,
        options: z
          .array(
            z.object({
              id: z.string(),
              text: z.string(),
            })
          )
          .length(4),
      })
    )
    .min(2)
    .max(4),
  createdAt: z.string(),
});

export type LearningSessionStatusSchema = z.infer<typeof learningSessionStatusSchema>;
export type SessionPathStateSchema = z.infer<typeof sessionPathStateSchema>;
export type SessionConceptQuizStatusSchema = z.infer<typeof sessionConceptQuizStatusSchema>;
export type ConceptQuizDifficultySchema = z.infer<typeof conceptQuizDifficultySchema>;
export type ConceptQuizSkillTagSchema = z.infer<typeof conceptQuizSkillTagSchema>;
export type LearningSessionSchema = z.infer<typeof learningSessionSchema>;
export type SessionPathItemSchema = z.infer<typeof sessionPathItemSchema>;
export type SessionConceptSchema = z.infer<typeof sessionConceptSchema>;
export type SessionEdgeSchema = z.infer<typeof sessionEdgeSchema>;
export type SessionConceptMasterySchema = z.infer<typeof sessionConceptMasterySchema>;
export type ConceptQuizSchema = z.infer<typeof conceptQuizSchema>;
