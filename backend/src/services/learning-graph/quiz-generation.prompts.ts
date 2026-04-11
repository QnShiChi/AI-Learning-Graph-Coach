import type {
  ChatMessageSchema,
  ConceptQuizDifficultySchema,
  ConceptQuizSkillTagSchema,
} from '@insforge/shared-schemas';
import { z } from 'zod';

export interface QuizGenerationPromptInput {
  conceptName: string;
  conceptDescription: string;
  explanationSummary: string;
  technicalExample: string | null;
  missingPrerequisites: string[];
  learnerMastery: number | null;
  difficultyTarget: ConceptQuizDifficultySchema;
  questionCountTarget: number;
  validationFeedback?: string[];
}

export const generatedQuizQuestionSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).length(4),
  correctAnswer: z.string().trim().min(1),
  explanationShort: z.string().trim().min(1),
  difficulty: z.enum(['core', 'medium', 'stretch']),
  skillTag: z.enum(['definition', 'distinction', 'analogy', 'application', 'misconception']),
});

export const generatedQuizPayloadSchema = z.object({
  questions: z.array(generatedQuizQuestionSchema).min(2).max(4),
});

export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;
export type GeneratedQuizPayload = z.infer<typeof generatedQuizPayloadSchema>;

const parseJsonFence = (value: string) => {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
};

const normalizeSkillTag = (value: unknown): ConceptQuizSkillTagSchema | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'definition':
    case 'distinction':
    case 'analogy':
    case 'application':
    case 'misconception':
      return normalized;
    default:
      return null;
  }
};

const normalizeDifficulty = (value: unknown): ConceptQuizDifficultySchema | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'core':
    case 'medium':
    case 'stretch':
      return normalized;
    default:
      return null;
  }
};

export function parseGeneratedQuizResponse(text: string): GeneratedQuizPayload | null {
  try {
    const normalizedText = parseJsonFence(text);
    const rawParsed = JSON.parse(normalizedText || '{}') as Record<string, unknown>;
    const rawQuestions = Array.isArray(rawParsed.questions) ? rawParsed.questions : [];

    const normalizedPayload = {
      questions: rawQuestions.map((item) => {
        const question = item as Record<string, unknown>;
        const options = Array.isArray(question.options)
          ? question.options.filter((option): option is string => typeof option === 'string')
          : [];

        return {
          question:
            typeof question.question === 'string'
              ? question.question
              : typeof question.prompt === 'string'
                ? question.prompt
                : '',
          options,
          correctAnswer:
            typeof question.correct_answer === 'string'
              ? question.correct_answer
              : typeof question.correctAnswer === 'string'
                ? question.correctAnswer
                : '',
          explanationShort:
            typeof question.explanation_short === 'string'
              ? question.explanation_short
              : typeof question.explanationShort === 'string'
                ? question.explanationShort
                : '',
          difficulty: normalizeDifficulty(question.difficulty) ?? 'core',
          skillTag: normalizeSkillTag(question.skill_tag ?? question.skillTag) ?? 'definition',
        };
      }),
    };

    const parsed = generatedQuizPayloadSchema.safeParse(normalizedPayload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildQuizGenerationMessages(
  input: QuizGenerationPromptInput
): ChatMessageSchema[] {
  const repairNote =
    input.validationFeedback && input.validationFeedback.length > 0
      ? `\nSửa lỗi của lần sinh trước:\n- ${input.validationFeedback.join('\n- ')}`
      : '';

  return [
    {
      role: 'system',
    content:
        'Bạn là hệ thống sinh quiz ngắn bằng tiếng Việt cho Learning Workspace. Hãy tạo quiz đo mức hiểu thật về concept hiện tại, không hỏi lại nguyên văn explanation, không hỏi meta về cách giải thích, không biến ví dụ kỹ thuật thành ẩn dụ đời thường vô căn cứ, và không dùng đáp án dài. Mỗi câu chỉ kiểm tra một ý, có đúng 4 lựa chọn ngắn, đúng 1 đáp án đúng rõ ràng, distractor phải liên quan nhưng đủ khác để phân biệt người hiểu và chưa hiểu. Chỉ trả về DUY NHẤT một JSON hợp lệ, không markdown, không giải thích ngoài JSON.',
    },
    {
      role: 'user',
      content: `Sinh quiz theo contract sau:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_answer": "string",
      "explanation_short": "string",
      "difficulty": "core|medium|stretch",
      "skill_tag": "definition|distinction|analogy|application|misconception"
    }
  ]
}

Ràng buộc:
- Toàn bộ nội dung phải bằng tiếng Việt.
- Sinh đúng ${input.questionCountTarget} câu hỏi.
- Mỗi lựa chọn nên ngắn, lý tưởng 5-18 từ.
- Không để 4 lựa chọn gần như cùng nghĩa.
- Không để nhiều hơn 1 lựa chọn cùng đúng.
- Bám sát concept hiện tại và explanation đã có, tránh đòi hỏi kiến thức ngoài bài.
- Nếu learner_mastery thấp hoặc đang thiếu prerequisite, ưu tiên câu dễ, trực tiếp, tập trung vào ý cốt lõi.

Ngữ cảnh:
${JSON.stringify(
  {
    language: 'vi',
    concept_name: input.conceptName,
    concept_description: input.conceptDescription,
    explanation_summary: input.explanationSummary,
    technical_example: input.technicalExample,
    missing_prerequisites: input.missingPrerequisites,
    learner_mastery: input.learnerMastery,
    difficulty_target: input.difficultyTarget,
    question_count_target: input.questionCountTarget,
  },
  null,
  2
)}${repairNote}`,
    },
  ];
}
