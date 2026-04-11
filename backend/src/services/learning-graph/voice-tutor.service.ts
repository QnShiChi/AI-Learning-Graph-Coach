import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import { VoiceAudioService, type VoiceAudioPayload } from './voice-audio.service.js';
import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';

const DEFAULT_REPLY_TEXT = 'Mình chưa nghe rõ, bạn nói lại giúp mình nhé.';
const MAX_SUMMARY_LENGTH = 1200;

interface VoiceTutorLessonContext {
  mainLesson: {
    definition: string;
    importance: string;
    corePoints: string[];
    technicalExample: string;
    commonMisconceptions: string[];
  };
}

interface VoiceTutorReplyInput {
  conceptName: string;
  lessonPackage: VoiceTutorLessonContext;
  prerequisiteNames: string[];
  priorSummary: string | null;
  learnerUtterance: string;
}

export class VoiceTutorService {
  constructor(
    private voiceAudioService = new VoiceAudioService(),
    private chatService = ChatCompletionService.getInstance()
  ) {}

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

  private sanitizeReplyText(text: string) {
    const segments = text.split(/(```[\s\S]*?```)/g);

    return segments
      .map((segment) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          return segment;
        }

        return segment
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
          .replace(/\n{3,}/g, '\n\n');
      })
      .join('')
      .trim();
  }

  private stripSpeechText(text: string) {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private async generateReplyText(input: VoiceTutorReplyInput) {
    try {
      const response = await this.chatService.chat(
        [
          {
            role: 'system',
            content:
              'Bạn là một người bạn học giỏi cùng lớp. Hãy trả lời bằng tiếng Việt, bám vào khái niệm hiện tại, prerequisites liên quan và nội dung bài học học thuật đang hiển thị. Trả lời đúng câu hỏi người học. Nếu họ xin giải thích dễ hiểu hơn, hãy đơn giản hóa cách diễn đạt nhưng không đổi bản chất khái niệm. Nếu họ hỏi ngoài phạm vi này, hãy kéo họ về khái niệm hiện tại. Trả lời ngắn gọn, rõ ý, tối đa 3 câu ngắn. Không dùng markdown nhấn mạnh như ** hoặc *. Chỉ khi người học xin ví dụ code thì mới dùng fenced code block ba dấu backtick với ngôn ngữ phù hợp.',
          },
          {
            role: 'user',
            content: [
              `Khái niệm hiện tại: ${input.conceptName}`,
              `Khái niệm là gì: ${input.lessonPackage.mainLesson.definition}`,
              `Vì sao quan trọng: ${input.lessonPackage.mainLesson.importance}`,
              `Ý cốt lõi: ${input.lessonPackage.mainLesson.corePoints.join(' | ')}`,
              `Ví dụ kỹ thuật: ${input.lessonPackage.mainLesson.technicalExample}`,
              `Điểm dễ hiểu sai: ${input.lessonPackage.mainLesson.commonMisconceptions.join(' | ') || 'không có'}`,
              `Prerequisites liên quan: ${input.prerequisiteNames.join(', ') || 'không có'}`,
              `Tóm tắt hội thoại trước: ${input.priorSummary ?? 'chưa có'}`,
              `Người học hỏi: ${input.learnerUtterance}`,
            ].join('\n'),
          },
        ],
        {
          model: 'google/gemini-2.0-flash-lite-001',
        temperature: 0.3,
          maxTokens: 220,
        }
      );

      return this.sanitizeReplyText(response.text.trim() || DEFAULT_REPLY_TEXT);
    } catch {
      throw new AppError(
        'Không thể nhận phản hồi cho voice tutor.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }
  }

  async transcribeLearnerAudio(input: { audioBuffer: Buffer; mimeType: string }) {
    return this.voiceAudioService.transcribe(input);
  }

  async reply(input: VoiceTutorReplyInput): Promise<{
    replyText: string;
    summary: string;
    audio: VoiceAudioPayload | null;
  }> {
    const replyText = await this.generateReplyText(input);
    const speechText = this.stripSpeechText(replyText);
    let audio: VoiceAudioPayload | null = null;

    if (speechText) {
      try {
        audio = await this.voiceAudioService.synthesize({ text: speechText });
      } catch (error) {
        if (!(error instanceof AppError)) {
          throw error;
        }
        audio = null;
      }
    }

    return {
      replyText,
      audio,
      summary: this.buildSummary({
        priorSummary: input.priorSummary,
        learnerUtterance: input.learnerUtterance,
        replyText,
      }),
    };
  }
}
