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
type LessonGrounding = LessonPackageSchema['grounding'];

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

  private stripListMarker(value: string) {
    return value
      .replace(/^\s*(?:[-*•]+|\d+[.)]?|[A-Za-z][.)])\s*/u, '')
      .trim();
  }

  private sanitizeSectionText(value: string) {
    return this.stripListMarker(value).replace(/\s+/g, ' ').trim();
  }

  private hasMinimumContent(value: string, minWordCount = 5, minLength = 24) {
    const sanitized = this.sanitizeSectionText(value);
    const normalized = this.normalize(sanitized);

    if (!normalized || /^\d+$/.test(normalized)) {
      return false;
    }

    return sanitized.length >= minLength && normalized.split(' ').filter(Boolean).length >= minWordCount;
  }

  private looksLikeCodeOrMarkup(value: string) {
    return (
      /[<>{}=()[\]]/.test(value) ||
      /\b(const|let|function|return|class|async|await|fetch|SELECT|INSERT|UPDATE|DELETE)\b/i.test(
        value
      )
    );
  }

  private hasExampleCue(value: string) {
    const normalized = this.normalize(value);
    return /\b(vi du|chang han|gia su|truong hop|thi nghiem|tinh huong|case study|khi|neu)\b/u.test(
      normalized
    );
  }

  private isGenericExamplePlaceholder(value: string) {
    const normalized = this.normalize(value);
    return (
      normalized.includes('chua duoc trich ro') ||
      normalized.includes('can bo sung source text chi tiet hon')
    );
  }

  private isPseudoExample(value: string) {
    const normalized = this.normalize(value);
    return /^(hieu vai tro cua|biet cach|la cach|la viec|giup hieu|de hieu)/.test(normalized);
  }

  private isContextualExampleCandidate(value: string) {
    const sanitized = this.sanitizeSectionText(value);

    if (
      !this.hasMinimumContent(sanitized, 6, 28) ||
      this.isGenericExamplePlaceholder(sanitized) ||
      this.isPseudoExample(sanitized)
    ) {
      return false;
    }

    if (this.looksLikeCodeOrMarkup(sanitized)) {
      return true;
    }

    return this.hasExampleCue(sanitized);
  }

  private selectContextualExample(input: {
    grounding: LessonGrounding;
    sourceText: string;
    siblingConceptNames: string[];
  }) {
    const candidates = this.collectMeaningfulLines(
      [
        input.grounding.sourceExcerpt,
        ...input.grounding.sourceHighlights,
        ...input.sourceText
          .split(/\r?\n/)
          .flatMap((line) => line.split(/(?<=[.!?…])\s+/)),
      ],
      input.siblingConceptNames,
      12
    );

    return candidates.find((candidate) => this.isContextualExampleCandidate(candidate)) ?? '';
  }

  private toSentence(value: string) {
    const normalized = this.sanitizeSectionText(value);

    if (!normalized) {
      return '';
    }

    return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`;
  }

  private extractSourceHighlights(sourceText: string, maxItems = 6) {
    const bulletMatches = sourceText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]?\s+/.test(line))
      .map((line) => this.sanitizeSectionText(line))
      .filter((line) => this.hasMinimumContent(line, 4, 18))
      .filter(Boolean);

    const highlights = bulletMatches.length
      ? bulletMatches
      : sourceText
          .split(/\r?\n/)
          .flatMap((line) => line.split(/[.!?]\s+/))
          .map((line) => this.sanitizeSectionText(line))
          .filter((line) => this.hasMinimumContent(line, 5, 24) && !line.endsWith(':'));

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

  private filterSiblingConceptBleed(values: string[], siblingConceptNames: string[]) {
    return values.filter((value) => {
      const normalizedValue = this.normalize(value);
      return !siblingConceptNames.some((name) =>
        normalizedValue.includes(this.normalize(name))
      );
    });
  }

  private collectMeaningfulLines(
    values: string[],
    siblingConceptNames: string[],
    maxItems = values.length
  ) {
    return this.dedupeLines(
      this.filterSiblingConceptBleed(
        values
          .map((value) => this.sanitizeSectionText(value))
          .filter((value) => this.hasMinimumContent(value, 4, 18)),
        siblingConceptNames
      )
    ).slice(0, maxItems);
  }

  private extractKeywords(values: string[]) {
    const stopWords = new Set([
      'va',
      'voi',
      'cho',
      'khi',
      'nhung',
      'nhieu',
      'mot',
      'moi',
      'cac',
      'the',
      'giup',
      'nguoi',
      'hoc',
      'hieu',
      'tren',
      'trong',
      'theo',
      'duoc',
      'nhu',
      'phan',
      'giao',
      'dien',
      'thanh',
      'co',
      'roi',
      'rang',
      'ung',
      'dung',
      'html',
      'css',
      'javascript',
    ]);

    return Array.from(
      new Set(
        values
          .flatMap((value) => this.normalize(value).split(' '))
          .filter((token) => token.length >= 4 && !stopWords.has(token))
      )
    );
  }

  private groundingOverlapCount(input: {
    text: string;
    grounding: LessonGrounding;
  }) {
    const lessonTokens = new Set(this.extractKeywords([input.text]));
    const groundingTokens = this.extractKeywords([
      input.grounding.sourceExcerpt,
      ...input.grounding.sourceHighlights,
    ]);

    return groundingTokens.filter((token) => lessonTokens.has(token)).length;
  }

  private buildLessonMessages(input: {
    conceptName: string;
    conceptDescription: string;
    grounding: LessonGrounding;
    sourceText: string;
    siblingConceptNames: string[];
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
    const groundingHighlights = this.collectMeaningfulLines(
      input.grounding.sourceHighlights,
      input.siblingConceptNames,
      5
    );
    const siblingConceptBlock =
      input.siblingConceptNames.length > 0
        ? input.siblingConceptNames.map((item) => `- ${item}`).join('\n')
        : '- không có';

    return [
      {
        role: 'user',
        content: `Hãy tạo lesson học thuật bằng tiếng Việt cho khái niệm "${input.conceptName}".

Mô tả khái niệm: ${input.conceptDescription}
Grounding chính cho khái niệm này:
${input.grounding.sourceExcerpt}

Các highlight đã được trích riêng cho khái niệm:
${groundingHighlights.length > 0 ? groundingHighlights.map((item) => `- ${item}`).join('\n') : '- không có'}

Nguồn toàn session chỉ dùng làm tham khảo phụ khi grounding còn thiếu:
${input.sourceText}

Các concept khác trong cùng session, không được biến thành trọng tâm của lesson:
${siblingConceptBlock}

Prerequisite còn thiếu:
${prerequisiteBlock}

Yêu cầu bắt buộc:
- Trả về JSON hợp lệ với các key: definition, importance, corePoints, technicalExample, commonMisconceptions, prerequisiteMiniLessons
- definition phải giải thích khái niệm là gì, không được chỉ lặp lại title
- importance phải trả lời vì sao người học cần hiểu khái niệm này bằng ít nhất một câu đầy đủ, không được trả về fragment ngắn kiểu "1." hoặc chỉ lặp heading
- corePoints phải có ít nhất 2 ý khác nhau, mỗi ý là một câu hoàn chỉnh có nội dung học tập rõ ràng chứ không phải numbering, title, hay fragment cụt
- technicalExample phải là ví dụ cụ thể bám theo ngữ cảnh của concept; có thể là code, markup, tình huống thực tế, thí nghiệm, case study, hoặc worked example rõ ràng
- commonMisconceptions chỉ gồm các hiểu sai có thể xảy ra thật sự
- Tập trung vào grounding của chính concept này; không lặp lại ý chính của các concept khác trong session
- Không dùng analogy mặc định, không giải thích theo kiểu Feynman, không viết giọng chatbot
- prerequisiteMiniLessons chỉ gồm các prerequisite có trong danh sách đã cho
${feedbackBlock}`,
      },
    ];
  }

  private validateAcademicLesson(input: {
    conceptName: string;
    lesson: LlmAcademicLesson;
    grounding: LessonGrounding;
    siblingConceptNames: string[];
  }) {
    const failures: string[] = [];
    const normalizedConceptName = this.normalize(input.conceptName);
    const cleanedDefinition = this.sanitizeSectionText(input.lesson.definition);
    const cleanedImportance = this.sanitizeSectionText(input.lesson.importance);
    const cleanedCorePoints = this.dedupeLines(
      input.lesson.corePoints
        .map((item) => this.sanitizeSectionText(item))
        .filter(Boolean)
    );
    const substantiveCorePoints = cleanedCorePoints.filter((item) =>
      this.hasMinimumContent(item, 4, 18)
    );
    const normalizedDefinition = this.normalize(cleanedDefinition);
    const normalizedImportance = this.normalize(cleanedImportance);
    const normalizedMisconceptions = input.lesson.commonMisconceptions
      .map((item) => this.sanitizeSectionText(item))
      .map((item) => this.normalize(item));

    if (!normalizedDefinition || normalizedDefinition === normalizedConceptName) {
      failures.push('definition is too close to concept title');
    }

    if (
      normalizedDefinition.length < Math.max(24, normalizedConceptName.length + 8)
    ) {
      failures.push('definition is too short to explain the concept');
    }

    if (
      !normalizedImportance ||
      normalizedImportance === normalizedDefinition ||
      !this.hasMinimumContent(cleanedImportance, 5, 24)
    ) {
      failures.push('importance does not explain practical or learning value');
    }

    if (substantiveCorePoints.length < 2) {
      failures.push('corePoints must contain at least two distinct substantive ideas');
    }

    const cleanedTechnicalExample = this.sanitizeSectionText(input.lesson.technicalExample);
    const normalizedTechnicalExample = this.normalize(cleanedTechnicalExample);
    const looksLikeCodeOrMarkup = this.looksLikeCodeOrMarkup(cleanedTechnicalExample);
    const exampleOverlapCount = this.groundingOverlapCount({
      text: cleanedTechnicalExample,
      grounding: input.grounding,
    });
    const mentionsConcept = normalizedTechnicalExample.includes(normalizedConceptName);

    if (
      this.isGenericExamplePlaceholder(cleanedTechnicalExample) ||
      !this.isContextualExampleCandidate(cleanedTechnicalExample) ||
      (!looksLikeCodeOrMarkup && exampleOverlapCount < 1 && !mentionsConcept)
    ) {
      failures.push('technicalExample does not provide a concrete contextual example');
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

    const lessonBody = [
      cleanedDefinition,
      cleanedImportance,
      ...substantiveCorePoints,
      input.lesson.technicalExample,
      ...input.lesson.commonMisconceptions.map((item) => this.sanitizeSectionText(item)),
    ].join(' ');
    const siblingMentions = input.siblingConceptNames.filter((name) =>
      this.normalize(lessonBody).includes(this.normalize(name))
    );
    if (siblingMentions.length > 0) {
      failures.push(
        `lesson content drifts into sibling concepts: ${siblingMentions.join(', ')}`
      );
    }

    if (input.grounding.quality === 'concept_specific') {
      const overlapCount = this.groundingOverlapCount({
        text: lessonBody,
        grounding: input.grounding,
      });

      if (overlapCount < 2) {
        failures.push('lesson is not grounded strongly enough in the concept excerpt');
      }
    }

    return failures;
  }

  private buildFallbackAcademicLesson(input: {
    conceptName: string;
    conceptDescription: string;
    grounding: LessonGrounding;
    sourceText: string;
    siblingConceptNames: string[];
  }) {
    const descriptionSentence = this.toSentence(
      input.conceptDescription ||
        `${input.conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`
    );
    const primarySource = input.grounding.sourceExcerpt.trim() || input.sourceText;
    const sourceHighlights = this.collectMeaningfulLines(
      [
        ...input.grounding.sourceHighlights,
        ...this.extractSourceHighlights(primarySource, 5),
      ],
      input.siblingConceptNames,
      5
    ).map((item) => this.toSentence(item));
    const uniqueCorePoints = this.dedupeLines(sourceHighlights).slice(0, 3);
    const importance =
      uniqueCorePoints[0] ??
      `Hiểu ${input.conceptName} giúp bạn đọc đúng cấu trúc, giải thích đúng cơ chế, và áp dụng kiến thức nhất quán hơn.`;
    const contextualExample = this.selectContextualExample({
      grounding: input.grounding,
      sourceText: input.sourceText,
      siblingConceptNames: input.siblingConceptNames,
    });

    return {
      definition: descriptionSentence,
      importance: this.toSentence(importance),
      corePoints:
        uniqueCorePoints.length >= 2
          ? uniqueCorePoints
          : [
              descriptionSentence,
              `Nội dung nguồn hiện tại nhấn mạnh rằng ${input.conceptName} cần được hiểu đúng theo ngữ cảnh học tập hiện tại.`,
            ],
      technicalExample:
        contextualExample
          ? this.toSentence(contextualExample)
          : 'Ví dụ cụ thể theo ngữ cảnh chưa được trích rõ từ nguồn học hiện tại; cần bổ sung source text chi tiết hơn.',
      commonMisconceptions: [],
    };
  }

  private async generateAcademicLessonWithRetry(input: {
    conceptName: string;
    conceptDescription: string;
    grounding: LessonGrounding;
    sourceText: string;
    siblingConceptNames: string[];
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
          grounding: input.grounding,
          siblingConceptNames: input.siblingConceptNames,
        });

        if (failures.length === 0) {
          return {
            contentQuality: 'validated' as const,
            lesson: {
              definition: this.toSentence(parsed.definition),
              importance: this.toSentence(parsed.importance),
              corePoints: this.dedupeLines(
                parsed.corePoints
                  .map((item) => this.toSentence(item))
                  .filter((item) => this.hasMinimumContent(item, 4, 18))
              ),
              technicalExample: parsed.technicalExample.trim(),
              commonMisconceptions: this.dedupeLines(
                parsed.commonMisconceptions
                  .map((item) => this.toSentence(item))
                  .filter((item) => this.hasMinimumContent(item, 4, 18))
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
    grounding: LessonGrounding;
    sourceText: string | null;
    siblingConceptNames: string[];
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
      grounding: input.grounding,
      sourceText,
      siblingConceptNames: input.siblingConceptNames,
      missingPrerequisites: input.missingPrerequisites,
    });

    return lessonPackageSchema.parse({
      version: input.version ?? 1,
      formatVersion: 2,
      contentQuality: lessonDraft.contentQuality,
      regenerationReason: input.regenerationReason ?? 'initial',
      grounding: input.grounding,
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
