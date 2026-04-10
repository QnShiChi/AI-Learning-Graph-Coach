import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../lib/hooks/useToast';
import { learningGraphService } from '../services/learning-graph.service';
import {
  blobToBase64,
  buildAudioDataUrl,
  type VoiceTutorPhase,
} from '../lib/voice-tutor';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

interface UseVoiceTutorOptions {
  sessionId?: string;
  conceptId?: string;
  lessonVersion?: number;
  openingText: string;
  onConfirmQuiz?: () => Promise<unknown> | unknown;
}

export function useVoiceTutor({
  sessionId,
  conceptId,
  lessonVersion,
  openingText,
  onConfirmQuiz,
}: UseVoiceTutorOptions) {
  const SILENCE_THRESHOLD = 0.018;
  const SILENCE_DURATION_MS = 1200;
  const MAX_RECORDING_MS = 20000;
  const NO_SPEECH_TIMEOUT_MS = 7000;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const monitorFrameRef = useRef<number | null>(null);
  const speechTranscriptRef = useRef('');
  const speechHadResultRef = useRef(false);
  const speechErrorHandledRef = useRef(false);
  const silenceSinceRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<VoiceTutorPhase>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualQuestion, setManualQuestion] = useState('');
  const [currentLearnerTranscript, setCurrentLearnerTranscript] = useState<string | null>(null);
  const [pendingLearnerTranscript, setPendingLearnerTranscript] = useState<string | null>(null);
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
  const [lastAudioDataUrl, setLastAudioDataUrl] = useState<string | null>(null);
  const [quizSuggestionVisible, setQuizSuggestionVisible] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['learning-graph', 'voice-history', sessionId, conceptId],
    queryFn: () => learningGraphService.getVoiceHistory(sessionId!, conceptId!),
    enabled: Boolean(sessionId && conceptId && lessonVersion),
  });

  const voiceTurnMutation = useMutation({
    mutationFn: (input: {
      lessonVersion: number;
      transcriptFallback?: string;
      audioInput?: { mimeType: string; base64Audio: string };
    }) => learningGraphService.createVoiceTurn(sessionId!, conceptId!, input),
  });

  const stopRecorderResources = () => {
    if (monitorFrameRef.current !== null) {
      window.cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = null;
    }
    silenceSinceRef.current = null;
    speechDetectedRef.current = false;
    recordingStartedAtRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  };

  const stopSpeechRecognitionResources = () => {
    speechRecognitionRef.current?.abort();
    speechRecognitionRef.current = null;
    speechTranscriptRef.current = '';
    speechHadResultRef.current = false;
    speechErrorHandledRef.current = false;
  };

  const clearTranscriptTimer = () => {
    if (transcriptTimerRef.current !== null) {
      window.clearTimeout(transcriptTimerRef.current);
      transcriptTimerRef.current = null;
    }
  };

  const stopAudioPlayback = () => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  };

  useEffect(
    () => () => {
      clearTranscriptTimer();
      stopRecorderResources();
      stopSpeechRecognitionResources();
      stopAudioPlayback();
    },
    []
  );

  useEffect(() => {
    setLiveAssistantTranscript('');
    setCurrentLearnerTranscript(null);
    setPendingLearnerTranscript(null);
    setQuizSuggestionVisible(false);
    setErrorMessage(null);
    setManualQuestion('');
    clearTranscriptTimer();
    stopAudioPlayback();
    stopRecorderResources();
    stopSpeechRecognitionResources();
    setPhase('ready');
  }, [conceptId, sessionId]);

  const streamAssistantTranscript = (transcript: string) =>
    new Promise<void>((resolve) => {
      clearTranscriptTimer();
      setLiveAssistantTranscript('');

      if (!transcript) {
        resolve();
        return;
      }

      let nextIndex = 0;

      const tick = () => {
        nextIndex = Math.min(transcript.length, nextIndex + 8);
        setLiveAssistantTranscript(transcript.slice(0, nextIndex));

        if (nextIndex >= transcript.length) {
          transcriptTimerRef.current = null;
          resolve();
          return;
        }

        transcriptTimerRef.current = window.setTimeout(tick, 18);
      };

      tick();
    });

  const playAssistantAudio = async (audioPayload: { mimeType: string; base64Audio: string } | null) => {
    const audioDataUrl = buildAudioDataUrl(audioPayload);
    setLastAudioDataUrl(audioDataUrl);

    if (!audioDataUrl) {
      return;
    }

    stopAudioPlayback();
    const audio = new Audio(audioDataUrl);
    audioRef.current = audio;
    setPhase('speaking');

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        resolve();
      };

      void audio.play().catch(() => {
        cleanup();
        resolve();
      });
    });
  };

  const submitTurn = async (
    input: {
      lessonVersion: number;
      transcriptFallback?: string;
      audioInput?: { mimeType: string; base64Audio: string };
    },
    optimisticLearnerTranscript?: string
  ) => {
    setErrorMessage(null);
    setQuizSuggestionVisible(false);
    setCurrentLearnerTranscript(null);
    setLiveAssistantTranscript('');
    setPendingLearnerTranscript(
      optimisticLearnerTranscript || input.transcriptFallback || 'Đang chép lại câu hỏi bằng giọng nói...'
    );
    setPhase('processing');

    try {
      const result = await voiceTurnMutation.mutateAsync(input);
      setPendingLearnerTranscript(result.learnerTranscript);
      setCurrentLearnerTranscript(result.learnerTranscript);
      setQuizSuggestionVisible(result.suggestQuiz);

      const audioPromise = playAssistantAudio(result.assistantAudio);
      await streamAssistantTranscript(result.assistantTranscript);
      await audioPromise;

      await queryClient.invalidateQueries({
        queryKey: ['learning-graph', 'voice-history', sessionId, conceptId],
      });
      setPendingLearnerTranscript(null);
      setCurrentLearnerTranscript(null);
      setLiveAssistantTranscript('');
      setPhase('ready');
      return result;
    } catch (error) {
      setPhase('error');
      const message = error instanceof Error ? error.message : 'Không thể xử lý lượt nói hiện tại.';
      setErrorMessage(message);
      showToast(message, 'error');
      throw error;
    }
  };

  const startRecording = async () => {
    if (!sessionId || !conceptId || !lessonVersion) {
      return;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
    const canRecordAudio =
      Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

    if (!canRecordAudio && !SpeechRecognitionCtor) {
      const message = 'Trình duyệt hiện tại chưa hỗ trợ ghi âm cho voice tutor.';
      setPhase('error');
      setErrorMessage(message);
      showToast(message, 'error');
      return;
    }

    stopAudioPlayback();
    clearTranscriptTimer();
    stopRecorderResources();
    stopSpeechRecognitionResources();
    setCurrentLearnerTranscript(null);
    setPendingLearnerTranscript(null);
    setLiveAssistantTranscript('');
    speechTranscriptRef.current = '';
    speechHadResultRef.current = false;
    speechErrorHandledRef.current = false;

    const isSpeechOnlyMode = !canRecordAudio;

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        speechRecognitionRef.current = recognition;
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setPhase('recording');
          setErrorMessage(null);
        };

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = result?.[0]?.transcript?.trim() ?? '';

            if (!transcript) {
              continue;
            }

            if (result.isFinal) {
              finalTranscript += `${transcript} `;
            } else {
              interimTranscript += `${transcript} `;
            }
          }

          const nextTranscript = (finalTranscript || interimTranscript).trim();
          if (!nextTranscript) {
            return;
          }

          speechHadResultRef.current = true;
          if (finalTranscript.trim()) {
            speechTranscriptRef.current = finalTranscript.trim();
          }
          setPendingLearnerTranscript(nextTranscript);
        };

        recognition.onerror = (event) => {
          speechErrorHandledRef.current = true;
          speechRecognitionRef.current = null;

          if (!isSpeechOnlyMode) {
            return;
          }

          const message =
            event.error === 'no-speech'
              ? 'Mình chưa nghe rõ câu hỏi của bạn. Hãy nói gần micro hơn hoặc dùng ô chat bên dưới.'
              : 'Không thể nhận diện giọng nói từ trình duyệt. Hãy thử lại hoặc nhập câu hỏi bằng chữ.';
          setPhase('error');
          setErrorMessage(message);
          showToast(message, 'error');
        };

        recognition.onend = () => {
          const finalTranscript = speechTranscriptRef.current.trim();
          const hasError = speechErrorHandledRef.current;
          speechRecognitionRef.current = null;
          speechErrorHandledRef.current = false;

          if (!isSpeechOnlyMode) {
            return;
          }

          speechTranscriptRef.current = '';
          speechHadResultRef.current = false;

          if (hasError) {
            return;
          }

          if (!finalTranscript) {
            setPhase('error');
            setErrorMessage(
              'Mình chưa nghe rõ câu hỏi của bạn. Hãy nói gần micro hơn hoặc dùng ô chat bên dưới.'
            );
            return;
          }

          void submitTurn(
            {
              lessonVersion,
              transcriptFallback: finalTranscript,
            },
            finalTranscript
          );
        };

        recognition.start();
      } catch (error) {
        stopSpeechRecognitionResources();

        if (isSpeechOnlyMode) {
          const message =
            error instanceof Error
              ? error.message
              : 'Không thể bật nhận diện giọng nói trên trình duyệt này.';
          setPhase('error');
          setErrorMessage(message);
          showToast(message, 'error');
          return;
        }
      }
    }

    if (!canRecordAudio) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = sourceNode;

      const monitorSilence = () => {
        const currentRecorder = recorderRef.current;
        const currentAnalyser = analyserRef.current;

        if (!currentRecorder || currentRecorder.state !== 'recording' || !currentAnalyser) {
          return;
        }

        const data = new Uint8Array(currentAnalyser.fftSize);
        currentAnalyser.getByteTimeDomainData(data);

        let sumSquares = 0;
        for (const value of data) {
          const normalized = value / 128 - 1;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / data.length);
        const now = Date.now();
        const recordingStartedAt = recordingStartedAtRef.current ?? now;

        if (rms > SILENCE_THRESHOLD) {
          speechDetectedRef.current = true;
          silenceSinceRef.current = null;
        } else if (speechDetectedRef.current) {
          silenceSinceRef.current = silenceSinceRef.current ?? now;
          if (now - silenceSinceRef.current >= SILENCE_DURATION_MS) {
            stopRecording();
            return;
          }
        } else if (now - recordingStartedAt >= NO_SPEECH_TIMEOUT_MS) {
          stopRecording();
          return;
        }

        if (now - recordingStartedAt >= MAX_RECORDING_MS) {
          stopRecording();
          return;
        }

        monitorFrameRef.current = window.requestAnimationFrame(monitorSilence);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopRecorderResources();
        setPhase('error');
        setErrorMessage('Micro gặp lỗi trong lúc ghi âm. Hãy thử lại.');
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        const hadSpeech = speechDetectedRef.current;
        const transcriptFallback = speechTranscriptRef.current.trim();
        stopRecorderResources();

        if (!hadSpeech && !transcriptFallback) {
          setPhase('error');
          setErrorMessage(
            'Mình chưa nghe rõ câu hỏi của bạn. Hãy nói gần micro hơn hoặc dùng ô chat bên dưới.'
          );
          return;
        }

        if (!audioBlob.size) {
          if (transcriptFallback) {
            speechTranscriptRef.current = '';
            speechHadResultRef.current = false;
            void submitTurn(
              {
                lessonVersion,
                transcriptFallback,
              },
              transcriptFallback
            );
            return;
          }

          setPhase('error');
          setErrorMessage('Không ghi nhận được audio từ micro. Hãy thử lại và nói gần micro hơn.');
          speechTranscriptRef.current = '';
          speechHadResultRef.current = false;
          return;
        }

        speechTranscriptRef.current = '';
        speechHadResultRef.current = false;

        void blobToBase64(audioBlob)
          .then((base64Audio) =>
            submitTurn({
              lessonVersion,
              transcriptFallback: transcriptFallback || undefined,
              audioInput: {
                mimeType: audioBlob.type || 'audio/webm',
                base64Audio,
              },
            })
          )
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : 'Không thể chuẩn bị audio để gửi cho tutor.';
            setPhase('error');
            setErrorMessage(message);
          });
      };

      recorderRef.current = recorder;
      setPhase('recording');
      setErrorMessage(null);
      speechDetectedRef.current = false;
      silenceSinceRef.current = null;
      recordingStartedAtRef.current = Date.now();
      recorder.start(250);
      monitorFrameRef.current = window.requestAnimationFrame(monitorSilence);
    } catch (error) {
      stopRecorderResources();
      stopSpeechRecognitionResources();
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể truy cập micro. Hãy kiểm tra quyền micro rồi thử lại.';
      setPhase('error');
      setErrorMessage(message);
      showToast(message, 'error');
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      setPhase('processing');
      return;
    }

    if (speechRecognitionRef.current) {
      setPhase('processing');
    }
  };

  const sendManualQuestion = async () => {
    const transcriptFallback = manualQuestion.trim();
    if (!transcriptFallback || !lessonVersion) {
      return;
    }

    setManualQuestion('');
    setCurrentLearnerTranscript(null);
    setLiveAssistantTranscript('');
    await submitTurn({
      lessonVersion,
      transcriptFallback,
    }, transcriptFallback);
  };

  const requestOpening = async () => {
    if (!lessonVersion) {
      return;
    }

    await submitTurn({
      lessonVersion,
      transcriptFallback: `Mở đầu bài học giúp tôi bằng tiếng Việt thật ngắn gọn dựa trên bài học hiện tại: ${openingText}`,
    });
  };

  const replayLastAudio = async () => {
    if (!lastAudioDataUrl) {
      return;
    }

    stopAudioPlayback();
    const audio = new Audio(lastAudioDataUrl);
    audioRef.current = audio;
    setPhase('speaking');
    await new Promise<void>((resolve) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        resolve();
      };

      void audio.play().catch(() => {
        cleanup();
        resolve();
      });
    });
    setPhase('ready');
  };

  const confirmQuizSuggestion = async () => {
    setQuizSuggestionVisible(false);
    if (onConfirmQuiz) {
      await onConfirmQuiz();
    }
  };

  return {
    isOpen,
    setIsOpen,
    phase,
    errorMessage,
    manualQuestion,
    setManualQuestion,
    currentLearnerTranscript,
    pendingLearnerTranscript,
    liveAssistantTranscript,
    historyTurns: historyQuery.data?.turns ?? [],
    isLoadingHistory: historyQuery.isLoading,
    isSubmittingTurn: voiceTurnMutation.isPending,
    isRecording: phase === 'recording',
    isProcessing: phase === 'processing' || phase === 'speaking',
    isAssistantTyping: phase === 'processing' || phase === 'speaking',
    quizSuggestionVisible,
    canReplayAudio: Boolean(lastAudioDataUrl),
    startRecording,
    stopRecording,
    sendManualQuestion,
    requestOpening,
    replayLastAudio,
    confirmQuizSuggestion,
    dismissQuizSuggestion: () => setQuizSuggestionVisible(false),
  };
}
