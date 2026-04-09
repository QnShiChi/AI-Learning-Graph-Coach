import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';

const DEFAULT_REPLY_TEXT = 'Mình chưa nghe rõ, bạn nói lại giúp mình nhé.';
const MAX_SUMMARY_LENGTH = 1200;

interface VoiceTutorLessonContext {
  feynmanExplanation: string;
  technicalTranslation: string;
}

interface VoiceTutorReplyInput {
  conceptName: string;
  lessonPackage: VoiceTutorLessonContext;
  prerequisiteNames: string[];
  priorSummary: string | null;
  learnerUtterance: string;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

export class VoiceTutorService {
  private requireConfig() {
    const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
    const model = process.env.OLLAMA_MODEL?.trim();

    if (!baseUrl || !model) {
      throw new AppError(
        'Voice sandbox chưa được cấu hình Ollama. Hãy đặt OLLAMA_BASE_URL và OLLAMA_MODEL.',
        503,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }

    return { baseUrl, model };
  }

  private buildSummary(input: {
    priorSummary: string | null;
    learnerUtterance: string;
    replyText: string;
  }) {
    const nextEntry = `Người học: ${input.learnerUtterance}\nGia sư: ${input.replyText}`;
    const summary = input.priorSummary
      ? `${input.priorSummary}\n${nextEntry}`
      : nextEntry;

    if (summary.length <= MAX_SUMMARY_LENGTH) {
      return summary;
    }

    return summary.slice(summary.length - MAX_SUMMARY_LENGTH);
  }

  async reply(input: VoiceTutorReplyInput) {
    const { baseUrl, model } = this.requireConfig();
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                'Bạn là một người bạn học giỏi cùng lớp. Hãy trả lời bằng tiếng Việt đơn giản, chỉ bám vào khái niệm hiện tại, prerequisites liên quan và nội dung bài học đang hiển thị. Nếu người học hỏi ngoài phạm vi này, hãy kéo họ về khái niệm hiện tại.',
            },
            {
              role: 'user',
              content: [
                `Khái niệm hiện tại: ${input.conceptName}`,
                `Bài học hiện tại: ${input.lessonPackage.feynmanExplanation}`,
                `Diễn giải kỹ thuật: ${input.lessonPackage.technicalTranslation}`,
                `Prerequisites liên quan: ${input.prerequisiteNames.join(', ') || 'không có'}`,
                `Tóm tắt hội thoại trước: ${input.priorSummary ?? 'chưa có'}`,
                `Người học hỏi: ${input.learnerUtterance}`,
              ].join('\n'),
            },
          ],
        }),
      });
    } catch {
      throw new AppError(
        'Không thể kết nối tới Ollama cho voice sandbox.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }

    if (!response.ok) {
      throw new AppError(
        'Không thể nhận phản hồi từ Ollama cho voice sandbox.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }

    let json: OllamaChatResponse;

    try {
      json = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new AppError(
        'Ollama trả về dữ liệu không hợp lệ cho voice sandbox.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }

    const replyText = json.message?.content?.trim() || DEFAULT_REPLY_TEXT;

    return {
      replyText,
      summary: this.buildSummary({
        priorSummary: input.priorSummary,
        learnerUtterance: input.learnerUtterance,
        replyText,
      }),
    };
  }
}
