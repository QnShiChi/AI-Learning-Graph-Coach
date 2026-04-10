import { z } from 'zod';
import {
  conceptQuizSchema,
  learningSessionSchema,
  sessionPathItemSchema,
  sessionConceptSchema,
  sessionConceptMasterySchema,
  sessionEdgeSchema,
} from './learning-graph.schema.js';

export const lessonImageMappingItemSchema = z.object({
  visualElement: z.string(),
  everydayMeaning: z.string(),
  technicalMeaning: z.string(),
  teachingPurpose: z.string(),
});

export const lessonPackageSchema = z.object({
  version: z.number().int().min(1),
  regenerationReason: z.enum([
    'initial',
    'failed_quiz',
    'simpler_reexplain',
    'prerequisite_refresh',
  ]),
  feynmanExplanation: z.string(),
  metaphorImage: z.object({
    imageUrl: z
      .string()
      .min(1)
      .refine(
        (value) => value.startsWith('data:image/') || /^https?:\/\//.test(value),
        'Expected an http(s) URL or data image URL'
      ),
    prompt: z.string(),
  }),
  imageMapping: z.array(lessonImageMappingItemSchema),
  imageReadingText: z.string(),
  technicalTranslation: z.string(),
  prerequisiteMiniLessons: z
    .array(
      z.object({
        prerequisiteConceptId: z.string().uuid(),
        title: z.string(),
        content: z.string(),
      })
    )
    .default([]),
});

export const voiceTutorAudioSchema = z.object({
  mimeType: z.string().min(1),
  base64Audio: z.string().min(1),
});

export const createVoiceTurnRequestSchema = z
  .object({
    lessonVersion: z.number().int().min(1),
    transcriptFallback: z.string().trim().min(1).optional(),
    audioInput: z
      .object({
        mimeType: z.string().min(1),
        base64Audio: z.string().min(1),
      })
      .optional(),
  })
  .refine((value) => Boolean(value.transcriptFallback || value.audioInput), {
    message: 'Either transcriptFallback or audioInput is required',
    path: ['transcriptFallback'],
  });

export const voiceHistoryTurnSchema = z.object({
  id: z.string().uuid(),
  learnerTranscript: z.string(),
  assistantTranscript: z.string(),
  lessonVersion: z.number().int().min(1),
  createdAt: z.string(),
});

export const createVoiceTurnResponseSchema = z.object({
  learnerTranscript: z.string(),
  assistantTranscript: z.string(),
  assistantAudio: voiceTutorAudioSchema.nullable(),
  summaryVersion: z.number().int().min(1),
  suggestQuiz: z.boolean(),
});

export const getVoiceHistoryResponseSchema = z.object({
  turns: z.array(voiceHistoryTurnSchema),
});

export const conceptRecapSchema = z.object({
  summary: z.string(),
  whyPassed: z.string(),
});

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

export const learningSessionLibraryItemSchema = z.object({
  session: learningSessionSchema,
  progress: z.object({
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
  }),
  currentConcept: sessionConceptSchema.nullable(),
});

export const getLearningSessionLibraryResponseSchema = z.object({
  sessions: z.array(learningSessionLibraryItemSchema),
  spotlightSession: learningSessionLibraryItemSchema.nullable(),
});

export const getConceptLearningResponseSchema = z.object({
  concept: sessionConceptSchema,
  mastery: sessionConceptMasterySchema.nullable(),
  prerequisites: z.array(sessionConceptSchema),
  lessonPackage: lessonPackageSchema,
  explanation: z.string().nullable(),
  quiz: conceptQuizSchema.nullable(),
  recap: conceptRecapSchema.nullable(),
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
export type LearningSessionLibraryItemSchema = z.infer<typeof learningSessionLibraryItemSchema>;
export type GetLearningSessionLibraryResponseSchema = z.infer<
  typeof getLearningSessionLibraryResponseSchema
>;
export type GetConceptLearningResponseSchema = z.infer<typeof getConceptLearningResponseSchema>;
export type GenerateConceptExplanationResponseSchema = z.infer<
  typeof generateConceptExplanationResponseSchema
>;
export type SubmitConceptQuizResponseSchema = z.infer<typeof submitConceptQuizResponseSchema>;
export type GetLearningGraphResponseSchema = z.infer<typeof getLearningGraphResponseSchema>;
export type LessonImageMappingItemSchema = z.infer<typeof lessonImageMappingItemSchema>;
export type LessonPackageSchema = z.infer<typeof lessonPackageSchema>;
export type VoiceTutorAudioSchema = z.infer<typeof voiceTutorAudioSchema>;
export type CreateVoiceTurnRequestSchema = z.infer<typeof createVoiceTurnRequestSchema>;
export type VoiceHistoryTurnSchema = z.infer<typeof voiceHistoryTurnSchema>;
export type CreateVoiceTurnResponseSchema = z.infer<typeof createVoiceTurnResponseSchema>;
export type GetVoiceHistoryResponseSchema = z.infer<typeof getVoiceHistoryResponseSchema>;
export type ConceptRecapSchema = z.infer<typeof conceptRecapSchema>;
