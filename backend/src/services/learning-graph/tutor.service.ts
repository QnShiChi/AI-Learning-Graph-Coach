import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import type { ChatMessageSchema } from '@insforge/shared-schemas';

export class TutorService {
  private chatService = ChatCompletionService.getInstance();

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
