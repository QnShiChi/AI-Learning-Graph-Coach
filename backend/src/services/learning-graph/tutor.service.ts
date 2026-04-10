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

  private toSentence(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return '';
    }

    return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`;
  }

  private extractSourceHighlights(sourceText: string, maxItems = 4) {
    const bulletMatches = sourceText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, '').trim())
      .filter(Boolean);

    const highlights = (bulletMatches.length > 0
      ? bulletMatches
      : sourceText
          .split(/\r?\n/)
          .flatMap((line) => line.split(/[.!?]\s+/))
          .map((line) => line.trim())
          .filter((line) => line.length > 24 && !line.endsWith(':'))) as string[];

    return highlights.slice(0, maxItems);
  }

  private inferLessonMetaphor(input: {
    conceptName: string;
    conceptDescription: string;
    sourceHighlights: string[];
    primaryPrerequisite: LessonPackagePrerequisiteInput | null;
  }) {
    const combined = [
      input.conceptName,
      input.conceptDescription,
      input.sourceHighlights.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    if (
      combined.includes('oop') ||
      combined.includes('object') ||
      combined.includes('class') ||
      combined.includes('hướng đối tượng')
    ) {
      return {
        shortMetaphor: 'một xưởng đóng xe có bản thiết kế treo trên tường và nhiều chiếc xe được tạo ra từ cùng bản thiết kế đó',
        prompt:
          'Hình dung OOP như một garage: trên tường có bản thiết kế của chiếc xe, còn dưới sàn là nhiều chiếc xe thật được tạo ra từ cùng bản thiết kế nhưng có màu sắc và trạng thái riêng.',
        readingText:
          'Trong hình này, bản thiết kế tượng trưng cho class, còn từng chiếc xe cụ thể tượng trưng cho object. Mỗi chiếc xe có dữ liệu riêng như màu sơn hay mức xăng, nhưng vẫn làm được các hành động giống nhau như nổ máy hoặc phanh.',
        mappings: [
          {
            visualElement: 'Bản thiết kế treo trên tường',
            everydayMeaning: 'Một mẫu chung để mọi chiếc xe cùng làm theo.',
            technicalMeaning: 'Class định nghĩa cấu trúc dữ liệu và hành vi chung của object.',
            teachingPurpose: 'Giúp người học phân biệt rõ class là khuôn mẫu, không phải vật thể đang chạy.',
          },
          {
            visualElement: 'Nhiều chiếc xe thật trong garage',
            everydayMeaning: 'Nhiều món đồ thật được tạo từ cùng một bản thiết kế.',
            technicalMeaning: 'Object là thực thể cụ thể được tạo ra từ class với trạng thái riêng.',
            teachingPurpose: 'Làm rõ mối liên hệ giữa class và object bằng ví dụ đời thường.',
          },
          {
            visualElement: 'Nút nổ máy và vô-lăng của từng xe',
            everydayMeaning: 'Mỗi chiếc xe có hành động riêng mà người lái có thể dùng.',
            technicalMeaning: 'Method là hành vi của object, còn thuộc tính là dữ liệu như màu sắc hay tốc độ.',
            teachingPurpose: 'Nối trực giác đời thường sang thuộc tính và phương thức.',
          },
        ],
        technicalFocus:
          'OOP tổ chức chương trình quanh class và object, trong đó class định nghĩa dữ liệu và hành vi chung còn object là thực thể cụ thể mang trạng thái riêng.',
      };
    }

    if (combined.includes('gradient descent') || combined.includes('learning rate')) {
      return {
        shortMetaphor: 'một người đi xuống sườn núi trong sương mù, mỗi bước phải đủ nhỏ để không vượt quá điểm thấp nhất',
        prompt:
          'Hình dung Gradient Descent như một người đang đi xuống núi trong sương mù, phải dò hướng dốc nhất và chọn bước chân vừa phải để xuống thấp dần.',
        readingText:
          'Độ dốc trong hình tương ứng với gradient, còn độ dài bước chân là learning rate. Nếu bước quá dài, người đi có thể lố qua điểm thấp nhất; nếu quá ngắn thì xuống rất chậm.',
        mappings: [
          {
            visualElement: 'Sườn núi dốc xuống',
            everydayMeaning: 'Tìm cách đi xuống nơi thấp hơn.',
            technicalMeaning: 'Loss surface cho biết mô hình đang ở vị trí tối ưu hay chưa.',
            teachingPurpose: 'Giúp người học hình dung mục tiêu tối ưu là giảm loss.',
          },
          {
            visualElement: 'Mũi tên chỉ hướng đi xuống',
            everydayMeaning: 'Hướng dễ đi xuống nhất tại điểm hiện tại.',
            technicalMeaning: 'Gradient chỉ hướng thay đổi lớn nhất, nên ta đi ngược gradient để giảm loss.',
            teachingPurpose: 'Nối trực giác hướng dốc với cơ chế cập nhật tham số.',
          },
        ],
        technicalFocus:
          'Gradient descent cập nhật tham số theo hướng làm loss giảm dần, với learning rate quyết định độ lớn của mỗi lần cập nhật.',
      };
    }

    const prerequisiteHint = input.primaryPrerequisite
      ? ` Trước khi đi sâu hơn, hãy coi ${input.primaryPrerequisite.displayName} như phần chân đế đang đỡ toàn bộ khái niệm này.`
      : '';

    return {
      shortMetaphor: `một bàn làm việc nơi mỗi ngăn kéo giữ một phần nhiệm vụ của ${input.conceptName}`,
      prompt: `Hình dung ${input.conceptName} như một bàn làm việc gọn gàng: mỗi ngăn giữ một phần thông tin, còn người dùng chỉ mở đúng phần cần thiết để hoàn thành việc đang làm.${prerequisiteHint}`,
      readingText: `Hình minh họa nhấn mạnh rằng ${input.conceptName} nên được hiểu qua những phần nhỏ, rõ vai trò, rồi mới ghép lại thành bức tranh kỹ thuật hoàn chỉnh.`,
      mappings: [
        {
          visualElement: `Các ngăn kéo trên bàn làm việc của ${input.conceptName}`,
          everydayMeaning: 'Mỗi ngăn giữ một phần việc riêng để người dùng không bị rối.',
          technicalMeaning: `${input.conceptName} gồm nhiều ý nhỏ liên kết với nhau, mỗi ý đóng một vai trò riêng trong hệ thống.`,
          teachingPurpose: 'Giúp người học chia nhỏ khái niệm trước khi ghép lại thành phần hiểu kỹ thuật.',
        },
      ],
      technicalFocus: this.toSentence(input.conceptDescription),
    };
  }

  private buildSvgDataUrl(input: {
    title: string;
    subtitle: string;
    accentLabel: string;
  }) {
    const escape = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#13231d"/>
            <stop offset="100%" stop-color="#203a63"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="720" rx="36" fill="url(#bg)"/>
        <rect x="56" y="56" width="1088" height="608" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
        <text x="92" y="128" fill="#8ce7c1" font-size="26" font-family="Arial, sans-serif" letter-spacing="3">AN DU DOI THUONG</text>
        <text x="92" y="216" fill="#ffffff" font-size="54" font-weight="700" font-family="Arial, sans-serif">${escape(input.title)}</text>
        <foreignObject x="92" y="258" width="1016" height="220">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 28px; line-height: 1.45; color: rgba(255,255,255,0.92);">
            ${escape(input.subtitle)}
          </div>
        </foreignObject>
        <rect x="92" y="548" width="360" height="82" rx="18" fill="rgba(140,231,193,0.15)" stroke="rgba(140,231,193,0.35)"/>
        <text x="122" y="599" fill="#d9fff0" font-size="28" font-weight="700" font-family="Arial, sans-serif">${escape(input.accentLabel)}</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  private toSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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
      const normalized = paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      uniqueParagraphs.push(paragraph);
    }

    return uniqueParagraphs.join('\n\n').trim();
  }

  private buildFeynmanExplanation(input: {
    conceptName: string;
    conceptDescription: string;
    masteryScore: number;
    missingPrerequisites: string[];
    shortMetaphor: string;
    sourceHighlights: string[];
  }) {
    const conceptName = input.conceptName.trim() || 'Khái niệm hiện tại';
    const conceptDescription = this.toSentence(
      input.conceptDescription.trim() ||
        `${conceptName} là một phần kiến thức quan trọng trong phiên học hiện tại.`
    );
    const prerequisiteSentence =
      input.missingPrerequisites.length > 0
        ? `Để hiểu chắc hơn, hãy nối nó với ${input.missingPrerequisites.join(', ')} trước khi làm quiz.`
        : 'Bạn có thể tập trung trực tiếp vào khái niệm này vì chưa có prerequisite nào đang thiếu.';
    const masteryPercent = Math.round(input.masteryScore * 100);
    const studyGoal =
      masteryPercent >= 70
        ? 'Bạn đã có nền tương đối ổn, nên mục tiêu là chốt lại trực giác và nối nó với ngôn ngữ kỹ thuật.'
        : 'Mục tiêu của phần này là biến trực giác đời thường thành cách giải thích đủ đơn giản để bạn tự nói lại.';
    const highlightSentence =
      input.sourceHighlights.length > 0
        ? `Điều cốt lõi bạn nên giữ trong đầu là ${input.sourceHighlights[0]!.replace(/^[A-ZÀ-Ỵ]/, (char) => char.toLowerCase())}.`
        : '';

    return [
      `${conceptName} có thể hiểu đơn giản như ${input.shortMetaphor}.`,
      conceptDescription,
      highlightSentence,
      `Hiện mastery của bạn khoảng ${masteryPercent}%. ${studyGoal}`,
      prerequisiteSentence,
    ]
      .filter(Boolean)
      .join(' ');
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
    const primaryPrerequisite = input.missingPrerequisites[0] ?? null;
    const prerequisiteNames = input.missingPrerequisites.map((item) => item.displayName);
    const sourceHighlights = this.extractSourceHighlights(sourceText);
    const metaphor = this.inferLessonMetaphor({
      conceptName,
      conceptDescription,
      sourceHighlights,
      primaryPrerequisite,
    });
    const technicalHighlights =
      sourceHighlights.length > 0
        ? `\n\nTrong phần học này, hãy giữ lại ${Math.min(sourceHighlights.length, 3)} ý chính:\n${sourceHighlights
            .slice(0, 3)
            .map((item) => `- ${item}`)
            .join('\n')}`
        : '';

    return lessonPackageSchema.parse({
      version: input.version ?? 1,
      regenerationReason: input.regenerationReason ?? 'initial',
      feynmanExplanation: this.buildFeynmanExplanation({
        conceptName,
        conceptDescription,
        masteryScore: input.masteryScore,
        missingPrerequisites: prerequisiteNames,
        shortMetaphor: metaphor.shortMetaphor,
        sourceHighlights,
      }),
      metaphorImage: {
        imageUrl: this.buildSvgDataUrl({
          title: conceptName,
          subtitle: metaphor.prompt,
          accentLabel: primaryPrerequisite
            ? `Noi voi ${primaryPrerequisite.displayName}`
            : 'Vi du doi thuong',
        }),
        prompt: metaphor.prompt,
      },
      imageMapping: metaphor.mappings,
      imageReadingText: metaphor.readingText,
      technicalTranslation: `${metaphor.technicalFocus}${technicalHighlights}`,
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
        content: `Hãy giải thích bằng tiếng Việt về khái niệm "${input.conceptName}" cho người học.

Yêu cầu bắt buộc:
- Chỉ viết nội dung giải thích, không mở đầu kiểu hội thoại như "Chào bạn", "Chúng ta sẽ cùng..."
- Không viết lời động viên, không viết kiểu chatbot
- Không lặp lại cùng một ý theo nhiều câu gần giống nhau
- Ưu tiên 3 đến 5 đoạn ngắn, mỗi đoạn tập trung một ý
- Dùng ví dụ đời thường khi phù hợp, nhưng giữ văn phong gọn, trực tiếp

Mô tả ngắn: "${input.conceptDescription}".
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
