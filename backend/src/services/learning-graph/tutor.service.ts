import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import {
  lessonPackageSchema,
  type LessonPackageSchema,
  type ChatMessageSchema,
} from '@insforge/shared-schemas';

interface LessonPackagePrerequisiteInput {
  id: string;
  displayName: string;
  description: string;
}

export class TutorService {
  private chatService = ChatCompletionService.getInstance();

  private toSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildFeynmanExplanation(input: {
    conceptName: string;
    conceptDescription: string;
    masteryScore: number;
    missingPrerequisites: string[];
  }) {
    const conceptName = input.conceptName.trim() || 'Khái niệm hiện tại';
    const conceptDescription =
      input.conceptDescription.trim() ||
      `${conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`;
    const prerequisiteSentence =
      input.missingPrerequisites.length > 0
        ? `Để hiểu chắc hơn, hãy liên hệ nó với ${input.missingPrerequisites.join(', ')} trước khi làm quiz.`
        : 'Bạn có thể tập trung trực tiếp vào khái niệm này vì chưa có prerequisite nào đang thiếu.';
    const masteryPercent = Math.round(input.masteryScore * 100);

    return `${conceptName} có thể hình dung như một quy trình tìm ra chỗ sai rồi lần ngược từng bước để sửa hệ thống. ${conceptDescription} Hiện mức mastery của bạn khoảng ${masteryPercent}%, vì vậy mục tiêu của bài học là biến trực giác đó thành cách giải thích đủ đơn giản để bạn tự nói lại. ${prerequisiteSentence}`;
  }

  async generateLessonPackage(input: {
    conceptName: string;
    conceptDescription: string;
    sourceText: string | null;
    masteryScore: number;
    missingPrerequisites: LessonPackagePrerequisiteInput[];
    regenerationReason?: LessonPackageSchema['regenerationReason'];
  }): Promise<LessonPackageSchema> {
    const conceptName = input.conceptName.trim() || 'Khái niệm hiện tại';
    const conceptDescription =
      input.conceptDescription.trim() ||
      `${conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`;
    const sourceText =
      input.sourceText?.trim() ||
      `Nguồn học tập hiện tại xoay quanh ${conceptName} và cách áp dụng nó vào phiên học này.`;
    const primaryPrerequisite = input.missingPrerequisites[0] ?? null;
    const conceptSlug = this.toSlug(conceptName) || 'lesson-package';
    const prerequisiteNames = input.missingPrerequisites.map((item) => item.displayName);

    return lessonPackageSchema.parse({
      version: 1,
      regenerationReason: input.regenerationReason ?? 'initial',
      feynmanExplanation: this.buildFeynmanExplanation({
        conceptName,
        conceptDescription,
        masteryScore: input.masteryScore,
        missingPrerequisites: prerequisiteNames,
      }),
      metaphorImage: {
        imageUrl: `https://example.com/learning-graph/${conceptSlug}.png`,
        prompt: primaryPrerequisite
          ? `Minh hoạ ${conceptName} như một hệ thống lần ngược lỗi dựa trên nền tảng ${primaryPrerequisite.displayName}.`
          : `Minh hoạ ${conceptName} như một hệ thống lần ngược lỗi để sửa từng bước.`,
      },
      imageMapping: [
        {
          visualElement: primaryPrerequisite
            ? `Một dây dẫn nối ${primaryPrerequisite.displayName} với ${conceptName}`
            : `Một bảng điều khiển trung tâm của ${conceptName}`,
          everydayMeaning: primaryPrerequisite
            ? 'Muốn sửa phần sau thì cần hiểu phần nền đang nâng đỡ nó.'
            : 'Mọi tín hiệu đều quay về một nơi để kiểm tra lại.',
          technicalMeaning: primaryPrerequisite
            ? `${primaryPrerequisite.displayName} cung cấp nền tảng để ${conceptName} vận hành đúng.`
            : `${conceptName} tổng hợp tín hiệu và điều chỉnh theo sai số quan sát được.`,
          teachingPurpose: primaryPrerequisite
            ? 'Giúp người học nối prerequisite còn thiếu với khái niệm chính đang học.'
            : 'Tạo một hình ảnh đơn giản để người học nhớ hướng đi của lời giải thích.',
        },
      ],
        imageReadingText: primaryPrerequisite
        ? `Hãy nhìn từ ${primaryPrerequisite.displayName} sang ${conceptName}: hình ảnh này nhắc rằng phần nền phải rõ trước khi cơ chế chính trở nên dễ hiểu.`
        : `Hãy tưởng tượng mọi tín hiệu quay về bảng điều khiển của ${conceptName}; đó là cách ta phát hiện và sửa lỗi từng bước.`,
      technicalTranslation: `${conceptName} được mô tả kỹ thuật là cơ chế dùng tín hiệu sai số để điều chỉnh tham số hoặc trạng thái bên trong hệ thống. ${conceptDescription} Nguồn học tập hiện tại nhấn mạnh: ${sourceText}`,
      prerequisiteMiniLessons: input.missingPrerequisites.map((item) => ({
        prerequisiteConceptId: item.id,
        title: `Ôn lại ${item.displayName}`,
        content: `${item.displayName}: ${item.description}`,
      })),
    });
  }

  async generateExplanation(input: {
    conceptName: string;
    conceptDescription: string;
    masteryScore: number;
    missingPrerequisites: string[];
  }) {
    const messages: ChatMessageSchema[] = [
      {
        role: 'user',
        content: `Giải thích bằng tiếng Việt về khái niệm "${input.conceptName}" cho người học. Mô tả ngắn: "${input.conceptDescription}". Mức mastery hiện tại: ${input.masteryScore}. Các prerequisite còn thiếu: ${input.missingPrerequisites.join(', ') || 'không có'}.`,
      },
    ];

    const result = await this.chatService.chat(messages, {
      model: 'google/gemini-2.0-flash-lite-001',
      temperature: 0.4,
    });

    return result.text || '';
  }
}
