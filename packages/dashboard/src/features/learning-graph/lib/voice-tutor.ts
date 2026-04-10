import type { VoiceTutorAudioPayload } from '../services/learning-graph.service';

export type VoiceTutorPhase = 'ready' | 'recording' | 'processing' | 'speaking' | 'error';

export function getVoiceTutorStatusCopy(input: {
  phase: VoiceTutorPhase;
  hasError: boolean;
}) {
  if (input.hasError || input.phase === 'error') {
    return {
      badge: 'Có lỗi',
      helper: 'Voice tutor gặp lỗi. Bạn có thể thử lại hoặc dùng nhập câu hỏi bằng chữ.',
    };
  }

  switch (input.phase) {
    case 'recording':
      return {
        badge: 'Đang nghe',
        helper: 'Nói tự nhiên như chat voice. Tutor sẽ tự trả lời khi bạn dừng nói một lúc ngắn.',
      };
    case 'processing':
      return {
        badge: 'Đang xử lý',
        helper: 'Đã nhận lượt nói. Tutor đang chuyển giọng nói thành văn bản và soạn câu trả lời.',
      };
    case 'speaking':
      return {
        badge: 'Đang trả lời',
        helper: 'Tutor đang phát audio và cập nhật transcript theo lượt trả lời hiện tại.',
      };
    default:
      return {
        badge: 'Sẵn sàng',
        helper: 'Bật mic để nói hoặc gõ câu hỏi như một khung chat bình thường.',
      };
  }
}

export async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function buildAudioDataUrl(audio: VoiceTutorAudioPayload | null) {
  if (!audio) {
    return null;
  }

  return `data:${audio.mimeType};base64,${audio.base64Audio}`;
}

export function stripCodeFromSpeechText(text: string) {
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
