import { Button } from '@insforge/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VoiceTutorReplyPayload } from '../services/learning-graph.service';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface VoiceTutorSandboxPanelProps {
  openingText: string;
  onAsk: (utterance: string) => Promise<VoiceTutorReplyPayload>;
}

export function VoiceTutorSandboxPanel({
  openingText,
  onAsk,
}: VoiceTutorSandboxPanelProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const speechSynthesisApi = useMemo(
    () => (typeof window === 'undefined' ? null : window.speechSynthesis),
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const RecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setIsSupported(false);
      return undefined;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setErrorMessage(null);
      setIsListening(true);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setErrorMessage('Không thể dùng microphone trên trình duyệt này. Hãy thử lại hoặc kiểm tra quyền truy cập.');
    };
    recognition.onresult = async (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() ?? '';

      setTranscript(text);
      setIsListening(false);

      if (!text) {
        setErrorMessage('Không nhận được nội dung giọng nói. Hãy thử nói lại rõ hơn.');
        return;
      }

      try {
        setErrorMessage(null);
        setIsSubmitting(true);
        const result = await onAsk(text);
        setReplyText(result.replyText);

        if (speechSynthesisApi) {
          speechSynthesisApi.cancel();
          const utterance = new SpeechSynthesisUtterance(result.replyText);
          utterance.lang = 'vi-VN';
          speechSynthesisApi.speak(utterance);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể nhận phản hồi từ voice sandbox.'
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onAsk, speechSynthesisApi]);

  const handlePlayOpening = () => {
    if (!speechSynthesisApi) {
      setErrorMessage('Trình duyệt hiện tại không hỗ trợ phát giọng nói.');
      return;
    }

    setErrorMessage(null);
    speechSynthesisApi.cancel();
    const utterance = new SpeechSynthesisUtterance(openingText);
    utterance.lang = 'vi-VN';
    speechSynthesisApi.speak(utterance);
  };

  const handleStartListening = () => {
    if (!recognitionRef.current || isSubmitting) {
      return;
    }

    setErrorMessage(null);

    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
      setErrorMessage(
        'Không thể bật micro lúc này. Hãy kiểm tra quyền truy cập hoặc thử lại sau vài giây.'
      );
    }
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
  };

  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Voice sandbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Khu thử nghiệm riêng cho hội thoại giọng nói trên đúng khái niệm hiện tại.
          </p>
        </div>
        <div className="rounded-full border border-[var(--alpha-8)] px-3 py-1 text-xs text-muted-foreground">
          {isSupported ? 'Web Speech sẵn sàng' : 'Trình duyệt chưa hỗ trợ'}
        </div>
      </div>

      <div className="mt-4 rounded-md bg-[var(--alpha-4)] p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mở đầu</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{openingText}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={!isSupported || isSubmitting}
        >
          {isListening ? 'Dừng micro' : isSubmitting ? 'Đang hỏi...' : 'Bật micro'}
        </Button>
        <Button type="button" variant="outline" onClick={handlePlayOpening}>
          Nghe mở đầu
        </Button>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {transcript ? (
        <div className="mt-4 rounded-md border border-[var(--alpha-8)] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bạn vừa nói</p>
          <p className="mt-2 text-sm text-foreground">{transcript}</p>
        </div>
      ) : null}

      {replyText ? (
        <div className="mt-4 rounded-md border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tutor trả lời</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{replyText}</p>
        </div>
      ) : null}
    </section>
  );
}
