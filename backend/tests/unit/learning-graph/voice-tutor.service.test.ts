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
        mainLesson: {
          definition: 'OOP tổ chức chương trình quanh class và object.',
          importance: 'Giúp gom dữ liệu và hành vi theo từng thực thể.',
          corePoints: ['Class là khuôn mẫu.', 'Object là thực thể cụ thể.'],
          technicalExample: 'const car = new Car();',
          commonMisconceptions: ['Class không phải object đang chạy.'],
        },
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
        mainLesson: {
          definition: 'Class định nghĩa cấu trúc, object là instance cụ thể.',
          importance: 'Phân biệt hai khái niệm này giúp tổ chức chương trình đúng cách.',
          corePoints: ['Class là khuôn mẫu.', 'Object mang trạng thái riêng.'],
          technicalExample: 'const car = new Car();',
          commonMisconceptions: ['Class không phải object cụ thể.'],
        },
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
