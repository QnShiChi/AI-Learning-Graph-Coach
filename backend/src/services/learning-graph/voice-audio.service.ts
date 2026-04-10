import OpenAI from 'openai';
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import logger from '@/utils/logger.js';

export interface VoiceAudioPayload {
  mimeType: string;
  base64Audio: string;
}

export class VoiceAudioService {
  private client: OpenAI | null;

  constructor(client: OpenAI | null = null) {
    this.client = client;
  }

  private ensureConfigured() {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new AppError(
        'Thiếu OPENAI_API_KEY cho voice tutor.',
        503,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }
  }

  private getClient() {
    this.ensureConfigured();
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    return this.client;
  }

  private normalizeMimeType(mimeType: string) {
    return mimeType.split(';')[0]?.trim() || 'audio/webm';
  }

  private resolveFilename(mimeType: string) {
    switch (mimeType) {
      case 'audio/mp4':
      case 'audio/m4a':
        return 'voice-turn.m4a';
      case 'audio/mpeg':
        return 'voice-turn.mp3';
      case 'audio/wav':
      case 'audio/x-wav':
        return 'voice-turn.wav';
      case 'audio/ogg':
        return 'voice-turn.ogg';
      case 'audio/webm':
      default:
        return 'voice-turn.webm';
    }
  }

  async transcribe(input: { audioBuffer: Buffer; mimeType: string }) {
    const normalizedMimeType = this.normalizeMimeType(input.mimeType);

    try {
      const file = await OpenAI.toFile(input.audioBuffer, this.resolveFilename(normalizedMimeType), {
        type: normalizedMimeType,
      });
      const models = ['gpt-4o-mini-transcribe', 'whisper-1'] as const;
      let lastError: unknown = null;

      for (const model of models) {
        try {
          const response = await this.getClient().audio.transcriptions.create({
            file,
            model,
          });

          return response.text.trim();
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    } catch (error) {
      logger.error('Voice transcription failed', {
        mimeType: normalizedMimeType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(
        'Không thể chuyển giọng nói thành văn bản bằng OpenAI.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }
  }

  async synthesize(input: { text: string }): Promise<VoiceAudioPayload> {
    try {
      const response = await this.getClient().audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: input.text,
        response_format: 'mp3',
      });
      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        mimeType: 'audio/mpeg',
        base64Audio: buffer.toString('base64'),
      };
    } catch {
      throw new AppError(
        'Không thể tạo audio phản hồi bằng OpenAI.',
        502,
        ERROR_CODES.AI_UPSTREAM_UNAVAILABLE
      );
    }
  }
}
