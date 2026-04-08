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
        content: `Giai thich bang tieng Viet ve khái niệm "${input.conceptName}" cho nguoi hoc. Mo ta ngan: "${input.conceptDescription}". Muc mastery hien tai: ${input.masteryScore}. Cac prerequisite con thieu: ${input.missingPrerequisites.join(', ') || 'khong co'}.`,
      },
    ];

    const result = await this.chatService.chat(messages, {
      model: 'openai/gpt-4.1-mini',
      temperature: 0.4,
    });

    return result.text || '';
  }
}
