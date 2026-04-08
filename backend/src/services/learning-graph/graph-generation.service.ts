import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import type { ChatMessageSchema } from '@insforge/shared-schemas';

export class GraphGenerationService {
  private chatService = ChatCompletionService.getInstance();

  async generate(rawText: string) {
    const messages: ChatMessageSchema[] = [
      {
        role: 'user',
        content: `Doc noi dung sau va tra ve JSON voi concepts va edges. Chi tra ve JSON hop le.\n\n${rawText}`,
      },
    ];

    const result = await this.chatService.chat(messages, {
      model: 'openai/gpt-4.1-mini',
      temperature: 0.2,
    });

    return JSON.parse(result.text || '{}');
  }
}
