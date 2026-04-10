import { describe, expect, it } from 'vitest';
import {
  buildAudioDataUrl,
  getVoiceTutorStatusCopy,
  stripCodeFromSpeechText,
} from '../voice-tutor';

describe('voice-tutor helpers', () => {
  it('returns ready status copy by default', () => {
    expect(getVoiceTutorStatusCopy({ phase: 'ready', hasError: false })).toEqual({
      badge: 'Sẵn sàng',
      helper: 'Bật mic để nói hoặc gõ câu hỏi như một khung chat bình thường.',
    });
  });

  it('returns recording and processing status copy', () => {
    expect(getVoiceTutorStatusCopy({ phase: 'recording', hasError: false }).badge).toBe(
      'Đang nghe'
    );
    expect(getVoiceTutorStatusCopy({ phase: 'processing', hasError: false }).badge).toBe(
      'Đang xử lý'
    );
  });

  it('builds a replayable audio data url when the backend returns audio', () => {
    expect(
      buildAudioDataUrl({
        mimeType: 'audio/mpeg',
        base64Audio: 'ZmFrZQ==',
      })
    ).toBe('data:audio/mpeg;base64,ZmFrZQ==');
  });

  it('strips code blocks from speech text while keeping prose', () => {
    expect(
      stripCodeFromSpeechText(
        'Class là bản thiết kế.\n```ts\nconst car = new Car();\n```\nObject là chiếc xe thật.'
      )
    ).toBe('Class là bản thiết kế.\n\nObject là chiếc xe thật.');
  });
});
