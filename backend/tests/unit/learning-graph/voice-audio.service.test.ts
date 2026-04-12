import { beforeEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { AppError } from '@/api/middlewares/error.js';
import { VoiceAudioService } from '@/services/learning-graph/voice-audio.service.js';

describe('VoiceAudioService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('falls back to whisper and normalizes browser audio mime types for transcription', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('unsupported model'))
      .mockResolvedValueOnce({ text: 'class là bản thiết kế' });
    const toFileSpy = vi
      .spyOn(OpenAI, 'toFile')
      .mockResolvedValue('mock-file' as unknown as File);

    const service = new VoiceAudioService({
      audio: {
        transcriptions: {
          create,
        },
      },
    } as unknown as OpenAI);

    const result = await service.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      mimeType: 'audio/webm;codecs=opus',
    });

    expect(result).toBe('class là bản thiết kế');
    expect(toFileSpy).toHaveBeenCalledWith(expect.any(Buffer), 'voice-turn.webm', {
      type: 'audio/webm',
    });
    expect(create).toHaveBeenNthCalledWith(1, {
      file: 'mock-file',
      language: 'vi',
      model: 'gpt-4o-mini-transcribe',
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      file: 'mock-file',
      language: 'vi',
      model: 'whisper-1',
    });
  });

  it('throws an AppError when every transcription model fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('still failing'));
    vi.spyOn(OpenAI, 'toFile').mockResolvedValue('mock-file' as unknown as File);

    const service = new VoiceAudioService({
      audio: {
        transcriptions: {
          create,
        },
      },
    } as unknown as OpenAI);

    await expect(
      service.transcribe({
        audioBuffer: Buffer.from('fake-audio'),
        mimeType: 'audio/webm;codecs=opus',
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});
