import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import {
  lessonPackageSchema,
  type ChatMessageSchema,
  type LessonPackageSchema,
} from '@insforge/shared-schemas';
import { z } from 'zod';

interface LessonPackagePrerequisiteInput {
  id: string;
  displayName: string;
  description: string;
}

type TutorServiceDependencies = {
  chatService?: Pick<ChatCompletionService, 'chat'>;
};

const llmAcademicLessonSchema = z.object({
  definition: z.string(),
  importance: z.string(),
  corePoints: z.array(z.string()).min(2),
  technicalExample: z.string(),
  commonMisconceptions: z.array(z.string()).default([]),
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

type LlmAcademicLesson = z.infer<typeof llmAcademicLessonSchema>;

export class TutorService {
  private chatService: Pick<ChatCompletionService, 'chat'>;

  constructor(dependencies: TutorServiceDependencies = {}) {
    this.chatService = dependencies.chatService ?? ChatCompletionService.getInstance();
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toSentence(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return '';
    }

    return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`;
  }

  private extractSourceHighlights(sourceText: string, maxItems = 6) {
    const bulletMatches = sourceText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, '').trim())
      .filter(Boolean);

    const highlights = bulletMatches.length
      ? bulletMatches
      : sourceText
          .split(/\r?\n/)
          .flatMap((line) => line.split(/[.!?]\s+/))
          .map((line) => line.trim())
          .filter((line) => line.length > 20 && !line.endsWith(':'));

    return highlights.slice(0, maxItems);
  }

  private cleanExplanationOutput(value: string) {
    const cleanedParagraphs = value
      .replace(/\r/g, '')
      .split(/\n{2,}/)
      .map((paragraph) =>
        paragraph
          .replace(/^\s*[-*]\s+/gm, '')
          .replace(/^\s*\d+\.\s+/gm, '')
          .replace(/\*\*/g, '')
          .trim()
      )
      .filter(Boolean)
      .filter((paragraph) => {
        const normalized = paragraph.toLowerCase();
        return !(
          normalized.startsWith('chào bạn') ||
          normalized.startsWith('xin chào') ||
          normalized.startsWith('đừng lo lắng') ||
          normalized.startsWith('chúc bạn học tốt')
        );
      });

    const uniqueParagraphs: string[] = [];
    const seen = new Set<string>();

    for (const paragraph of cleanedParagraphs) {
      const normalized = this.normalize(paragraph);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      uniqueParagraphs.push(paragraph);
    }

    return uniqueParagraphs.join('\n\n').trim();
  }

  private dedupeLines(values: string[]) {
    const seen = new Set<string>();

    return values.filter((value) => {
      const normalized = this.normalize(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private buildLessonMessages(input: {
    conceptName: string;
    conceptDescription: string;
    sourceText: string;
    missingPrerequisites: LessonPackagePrerequisiteInput[];
    validationFeedback: string[];
  }): ChatMessageSchema[] {
    const prerequisiteBlock =
      input.missingPrerequisites.length > 0
        ? input.missingPrerequisites
            .map(
              (item) => `- ${item.displayName}: ${item.description} (id: ${item.id})`
            )
            .join('\n')
        : '- không có';

    const feedbackBlock =
      input.validationFeedback.length > 0
        ? `\nLần sinh trước bị từ chối vì:\n- ${input.validationFeedback.join('\n- ')}\nHãy sửa đúng các lỗi trên.`
        : '';

    return [
      {
        role: 'user',
        content: `Hãy tạo lesson học thuật bằng tiếng Việt cho khái niệm "${input.conceptName}".

Mô tả khái niệm: ${input.conceptDescription}
Nguồn học:
${input.sourceText}

Prerequisite còn thiếu:
${prerequisiteBlock}

Yêu cầu bắt buộc:
- Trả về JSON hợp lệ với các key: definition, importance, corePoints, technicalExample, commonMisconceptions, prerequisiteMiniLessons
- definition phải giải thích khái niệm là gì, không được chỉ lặp lại title
- importance phải trả lời vì sao người học cần hiểu khái niệm này
- corePoints phải có ít nhất 2 ý khác nhau
- technicalExample phải là ví dụ kỹ thuật cụ thể, có code, markup, pattern, hoặc tình huống kỹ thuật rõ ràng
- commonMisconceptions chỉ gồm các hiểu sai có thể xảy ra thật sự
- Không dùng analogy mặc định, không giải thích theo kiểu Feynman, không viết giọng chatbot
- prerequisiteMiniLessons chỉ gồm các prerequisite có trong danh sách đã cho
${feedbackBlock}`,
      },
    ];
  }

  private validateAcademicLesson(input: {
    conceptName: string;
    lesson: LlmAcademicLesson;
  }) {
    const failures: string[] = [];
    const normalizedConceptName = this.normalize(input.conceptName);
    const normalizedDefinition = this.normalize(input.lesson.definition);
    const normalizedImportance = this.normalize(input.lesson.importance);
    const normalizedMisconceptions = input.lesson.commonMisconceptions.map((item) =>
      this.normalize(item)
    );

    if (!normalizedDefinition || normalizedDefinition === normalizedConceptName) {
      failures.push('definition is too close to concept title');
    }

    if (
      normalizedDefinition.length < Math.max(24, normalizedConceptName.length + 8)
    ) {
      failures.push('definition is too short to explain the concept');
    }

    if (!normalizedImportance || normalizedImportance === normalizedDefinition) {
      failures.push('importance does not explain practical or learning value');
    }

    const uniqueCorePoints = this.dedupeLines(input.lesson.corePoints);
    if (uniqueCorePoints.length < 2) {
      failures.push('corePoints must contain at least two distinct ideas');
    }

    const normalizedTechnicalExample = this.normalize(input.lesson.technicalExample);
    const looksLikeCodeOrMarkup =
      /[<>{}=()[\];]/.test(input.lesson.technicalExample) ||
      /\b(const|let|function|return|class|async|await|fetch|SELECT|INSERT|UPDATE|DELETE)\b/i.test(
        input.lesson.technicalExample
      );
    const looksLikePseudoExample = /^hieu vai tro cua|^hiểu vai trò của|^biet cach|^biết cách/i.test(
      normalizedTechnicalExample
    );
    const mentionsConcreteUiPattern =
      /\b(header|main|section|article|nav|footer)\b/i.test(input.lesson.technicalExample) &&
      /<\s*(header|main|section|article|nav|footer)/i.test(input.lesson.technicalExample);

    if ((!looksLikeCodeOrMarkup && !mentionsConcreteUiPattern) || looksLikePseudoExample) {
      failures.push('technicalExample is descriptive but not an example');
    }

    if (
      normalizedMisconceptions.some(
        (item) =>
          !item ||
          item === normalizedDefinition ||
          item.includes('khong nen hieu sai') ||
          item.includes('khong nen nham')
      )
    ) {
      failures.push('commonMisconceptions contains generic template text');
    }

    return failures;
  }

  private buildFallbackAcademicLesson(input: {
    conceptName: string;
    conceptDescription: string;
    sourceText: string;
  }) {
    const descriptionSentence = this.toSentence(
      input.conceptDescription ||
        `${input.conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`
    );
    const sourceHighlights = this.extractSourceHighlights(input.sourceText, 5).map((item) =>
      this.toSentence(item)
    );
    const uniqueCorePoints = this.dedupeLines(sourceHighlights).slice(0, 3);
    const importance =
      uniqueCorePoints[0] ??
      `Hiểu ${input.conceptName} giúp bạn đọc đúng cấu trúc, giải thích đúng cơ chế, và áp dụng kiến thức nhất quán hơn.`;

    return {
      definition: descriptionSentence,
      importance: this.toSentence(importance),
      corePoints:
        uniqueCorePoints.length >= 2
          ? uniqueCorePoints
          : [
              descriptionSentence,
              `Nội dung nguồn hiện tại nhấn mạnh rằng ${input.conceptName} cần được hiểu đúng theo ngữ cảnh kỹ thuật.`,
            ],
      technicalExample:
        'Ví dụ kỹ thuật cụ thể chưa được trích rõ từ nguồn học hiện tại; cần bổ sung source text chi tiết hơn.',
      commonMisconceptions: [],
    };
  }

  private async generateAcademicLessonWithRetry(input: {
    conceptName: string;
    conceptDescription: string;
    sourceText: string;
    missingPrerequisites: LessonPackagePrerequisiteInput[];
  }) {
    let validationFeedback: string[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.chatService.chat(
          this.buildLessonMessages({
            ...input,
            validationFeedback,
          }),
          {
            model: 'google/gemini-2.0-flash-lite-001',
            temperature: attempt === 0 ? 0.2 : 0.1,
          }
        );

        const parsed = llmAcademicLessonSchema.parse(JSON.parse(result.text || '{}'));
        const failures = this.validateAcademicLesson({
          conceptName: input.conceptName,
          lesson: parsed,
        });

        if (failures.length === 0) {
          return {
            contentQuality: 'validated' as const,
            lesson: {
              definition: this.toSentence(parsed.definition),
              importance: this.toSentence(parsed.importance),
              corePoints: this.dedupeLines(parsed.corePoints.map((item) => this.toSentence(item))),
              technicalExample: parsed.technicalExample.trim(),
              commonMisconceptions: this.dedupeLines(
                parsed.commonMisconceptions.map((item) => this.toSentence(item))
              ),
            },
            prerequisiteMiniLessons: parsed.prerequisiteMiniLessons,
          };
        }

        validationFeedback = failures;
      } catch (error) {
        validationFeedback = [
          `invalid lesson output: ${error instanceof Error ? error.message : 'unknown parse error'}`,
        ];
      }
    }

    return {
      contentQuality: 'fallback' as const,
      lesson: this.buildFallbackAcademicLesson(input),
      prerequisiteMiniLessons: input.missingPrerequisites.map((item) => ({
        prerequisiteConceptId: item.id,
        title: `Ôn lại ${item.displayName}`,
        content: `${item.displayName}: ${item.description}`,
      })),
    };
  }

  async generateLessonPackage(input: {
    conceptName: string;
    conceptDescription: string;
    sourceText: string | null;
    masteryScore: number;
    missingPrerequisites: LessonPackagePrerequisiteInput[];
    regenerationReason?: LessonPackageSchema['regenerationReason'];
    version?: number;
  }): Promise<LessonPackageSchema> {
    const conceptName = input.conceptName.trim() || 'Khái niệm hiện tại';
    const conceptDescription =
      input.conceptDescription.trim() ||
      `${conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`;
    const sourceText =
      input.sourceText?.trim() ||
      `Nguồn học tập hiện tại xoay quanh ${conceptName} và cách áp dụng nó vào phiên học này.`;

    const lessonDraft = await this.generateAcademicLessonWithRetry({
      conceptName,
      conceptDescription,
      sourceText,
      missingPrerequisites: input.missingPrerequisites,
    });

    return lessonPackageSchema.parse({
      version: input.version ?? 1,
      formatVersion: 2,
      contentQuality: lessonDraft.contentQuality,
      regenerationReason: input.regenerationReason ?? 'initial',
      mainLesson: lessonDraft.lesson,
      prerequisiteMiniLessons: lessonDraft.prerequisiteMiniLessons,
    });
  }

  async generateExplanation(input: {
    conceptName: string;
    conceptDescription?: string;
    lessonSummary?: string;
    sourceText?: string | null;
    masteryScore: number;
    missingPrerequisites: string[];
  }) {
    const primarySource = input.lessonSummary?.trim() || input.conceptDescription?.trim() || '';
    const secondarySource = input.sourceText?.trim() || 'không có';
    const messages: ChatMessageSchema[] = [
      {
        role: 'user',
        content: `Hãy giải thích bằng tiếng Việt về khái niệm "${input.conceptName}" cho người học.

Yêu cầu bắt buộc:
- Chỉ viết nội dung giải thích, không mở đầu kiểu hội thoại như "Chào bạn", "Chúng ta sẽ cùng..."
- Không viết lời động viên, không viết kiểu chatbot
- Không lặp lại cùng một ý theo nhiều câu gần giống nhau
- Ưu tiên 3 đến 5 đoạn ngắn, mỗi đoạn tập trung một ý
- Dùng ví dụ đời thường khi phù hợp, nhưng giữ văn phong gọn, trực tiếp
- Nguồn chính: ${primarySource}
- Nguồn phụ: ${secondarySource}
- Không mâu thuẫn với nguồn chính; chỉ dùng nguồn phụ để diễn đạt mềm hơn khi cần

Mức mastery hiện tại: ${input.masteryScore}.
Các prerequisite còn thiếu: ${input.missingPrerequisites.join(', ') || 'không có'}.`,
      },
    ];

    const result = await this.chatService.chat(messages, {
      model: 'google/gemini-2.0-flash-lite-001',
      temperature: 0.4,
    });

    return this.cleanExplanationOutput(result.text || '');
  }
}
