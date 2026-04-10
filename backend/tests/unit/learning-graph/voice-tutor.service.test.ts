import { describe, expect, it, vi } from 'vitest';
import { VoiceTutorService } from '@/services/learning-graph/voice-tutor.service.js';
import { VoiceAudioService } from '@/services/learning-graph/voice-audio.service.js';
import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';

describe('VoiceTutorService', () => {
  it('returns a grounded assistant reply and audio payload using shared chat service', async () => {
    const synthesize = vi.fn().mockResolvedValue({
      mimeType: 'audio/mpeg',
      base64Audio: 'ZmFrZQ==',
    });
    const audioService = {
      synthesize,
    } as unknown as VoiceAudioService;
    const chat = vi.fn().mockResolvedValue({
      text: 'Class là bản thiết kế, object là chiếc xe thật.',
    });

    const service = new VoiceTutorService(audioService, {
      chat,
    } as unknown as ChatCompletionService);
    const result = await service.reply({
      conceptName: 'Giới thiệu về OOP',
      lessonPackage: {
        feynmanExplanation: 'Class là bản thiết kế, object là chiếc xe thật.',
        technicalTranslation: 'Class định nghĩa cấu trúc; object là thể hiện cụ thể.',
      },
      prerequisiteNames: [],
      priorSummary: null,
      learnerUtterance: 'giải thích lại giúp tôi class và object',
    });

    expect(result.replyText).toContain('Class là bản thiết kế');
    expect(result.audio).toEqual({ mimeType: 'audio/mpeg', base64Audio: 'ZmFrZQ==' });
    expect(synthesize).toHaveBeenCalledWith({
      text: 'Class là bản thiết kế, object là chiếc xe thật.',
    });
    expect(chat).toHaveBeenCalled();
  });

  it('does not send code blocks to speech synthesis', async () => {
    const synthesize = vi.fn().mockResolvedValue({
      mimeType: 'audio/mpeg',
      base64Audio: 'ZmFrZQ==',
    });
    const audioService = {
      synthesize,
    } as unknown as VoiceAudioService;
    const chat = vi.fn().mockResolvedValue({
      text: 'Class là bản thiết kế.\n```ts\nconst car = new Car();\n```\nObject là thể hiện cụ thể.',
    });

    const service = new VoiceTutorService(audioService, {
      chat,
    } as unknown as ChatCompletionService);

    await service.reply({
      conceptName: 'Class và Object',
      lessonPackage: {
        feynmanExplanation: 'Class là bản thiết kế, object là chiếc xe.',
        technicalTranslation: 'Class định nghĩa cấu trúc; object là instance.',
      },
      prerequisiteNames: [],
      priorSummary: null,
      learnerUtterance: 'cho ví dụ code',
    });

    expect(synthesize).toHaveBeenCalledWith({
      text: 'Class là bản thiết kế.\n\nObject là thể hiện cụ thể.',
    });
  });
});
