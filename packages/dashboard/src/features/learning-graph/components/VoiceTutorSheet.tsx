import { useEffect, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@insforge/ui';
import { Mic, PauseCircle, PlayCircle, SendHorizontal, Sparkles } from 'lucide-react';
import type { VoiceTutorHistoryTurn } from '../services/learning-graph.service';

interface VoiceTutorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: string;
  helperText: string;
  conceptName: string;
  openingText: string;
  currentLearnerTranscript: string | null;
  pendingLearnerTranscript: string | null;
  liveAssistantTranscript: string;
  historyTurns: VoiceTutorHistoryTurn[];
  manualQuestion: string;
  onManualQuestionChange: (value: string) => void;
  errorMessage: string | null;
  isLoadingHistory: boolean;
  isRecording: boolean;
  isSubmittingTurn: boolean;
  isProcessing: boolean;
  isAssistantTyping: boolean;
  canReplayAudio: boolean;
  quizSuggestionVisible: boolean;
  onRequestOpening: () => Promise<unknown> | unknown;
  onStartRecording: () => Promise<unknown> | unknown;
  onStopRecording: () => void;
  onSendManualQuestion: () => Promise<unknown> | unknown;
  onReplayLastAudio: () => Promise<unknown> | unknown;
  onConfirmQuizSuggestion: () => Promise<unknown> | unknown;
  onDismissQuizSuggestion: () => void;
}

export function VoiceTutorSheet({
  open,
  onOpenChange,
  badge,
  helperText,
  conceptName,
  openingText,
  currentLearnerTranscript,
  pendingLearnerTranscript,
  liveAssistantTranscript,
  historyTurns,
  manualQuestion,
  onManualQuestionChange,
  errorMessage,
  isLoadingHistory,
  isRecording,
  isSubmittingTurn,
  isProcessing,
  isAssistantTyping,
  canReplayAudio,
  quizSuggestionVisible,
  onRequestOpening,
  onStartRecording,
  onStopRecording,
  onSendManualQuestion,
  onReplayLastAudio,
  onConfirmQuizSuggestion,
  onDismissQuizSuggestion,
}: VoiceTutorSheetProps) {
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
      const viewport = messagesViewportRef.current;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [
    open,
    historyTurns.length,
    pendingLearnerTranscript,
    currentLearnerTranscript,
    liveAssistantTranscript,
    isAssistantTyping,
    quizSuggestionVisible,
  ]);

  const renderRichMessage = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g).filter(Boolean);

    return parts.map((part, index) => {
      const codeMatch = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
      if (codeMatch) {
        const language = codeMatch[1] || 'code';
        const code = codeMatch[2].trim();
        return (
          <div
            key={`code-${index}`}
            className="mt-3 overflow-hidden rounded-2xl border border-[var(--alpha-8)] bg-[rgb(10,15,24)]/90 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
          >
            <div className="border-b border-[var(--alpha-8)] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {language}
            </div>
            <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-6 text-emerald-100">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      return (
        <p key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-7 text-foreground">
          {part}
        </p>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-1/2 top-1/2 flex h-[min(80vh,760px)] max-h-[80vh] max-w-[900px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border-[var(--alpha-8)] bg-[rgb(var(--semantic-1))]/95 p-0 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <DialogHeader className="border-b border-[var(--alpha-8)] bg-[rgb(var(--semantic-1))]/95 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-300" />
            Voice tutor
          </DialogTitle>
          <DialogDescription>
            Chat voice về
            {' '}
            <span className="font-medium text-foreground">{conceptName}</span>
            . Bật mic và nói tự nhiên, tutor sẽ tự trả lời khi bạn ngắt câu.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
          <div className="border-b border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[var(--alpha-8)] px-3 py-1 text-xs text-muted-foreground">
                {badge}
              </div>
              <p className="text-sm text-muted-foreground">{helperText}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void onRequestOpening()}
                disabled={isSubmittingTurn}
              >
                Nghe mở đầu
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void onReplayLastAudio()}
                disabled={!canReplayAudio || isSubmittingTurn}
              >
                Nghe lại
              </Button>
            </div>
            {errorMessage ? (
              <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0))]">
            <div
              ref={messagesViewportRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 scroll-smooth"
            >
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Tutor mở đầu
                </p>
                <div className="mt-2">{renderRichMessage(openingText)}</div>
              </div>

              {isLoadingHistory ? (
                <p className="text-sm text-muted-foreground">Đang tải lịch sử hội thoại...</p>
              ) : (
                historyTurns.map((turn) => (
                  <div key={turn.id} className="space-y-3">
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md border border-emerald-500/15 bg-emerald-500/12 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_8px_24px_rgba(16,185,129,0.08)]">
                      {turn.learnerTranscript}
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                      {renderRichMessage(turn.assistantTranscript)}
                    </div>
                  </div>
                ))
              )}

              {(pendingLearnerTranscript || currentLearnerTranscript) ? (
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md border border-emerald-500/15 bg-emerald-500/12 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_8px_24px_rgba(16,185,129,0.08)]">
                  {pendingLearnerTranscript || currentLearnerTranscript}
                </div>
              ) : null}

              {liveAssistantTranscript ? (
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {renderRichMessage(liveAssistantTranscript)}
                </div>
              ) : null}

              {isAssistantTyping && !liveAssistantTranscript ? (
                <div className="max-w-[120px] rounded-2xl rounded-tl-md border border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                  </div>
                </div>
              ) : null}

              {quizSuggestionVisible ? (
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                  <p className="text-sm leading-7 text-emerald-100">
                    Mình nghĩ bạn đã nắm được ý chính. Nếu muốn, mình có thể mở quiz ngay bây giờ.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Button type="button" onClick={() => void onConfirmQuizSuggestion()}>
                      Mở quiz
                    </Button>
                    <Button type="button" variant="outline" onClick={onDismissQuizSuggestion}>
                      Hỏi thêm đã
                    </Button>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[var(--alpha-8)] bg-[rgb(var(--semantic-1))]/95 px-5 py-4">
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={isRecording ? onStopRecording : () => void onStartRecording()}
                  disabled={isSubmittingTurn && !isRecording}
                  className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full border transition ${
                    isRecording
                      ? 'border-red-400/50 bg-red-500/20 text-red-200'
                      : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                  }`}
                >
                  {isRecording ? <PauseCircle className="size-6" /> : <Mic className="size-6" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl border border-[var(--alpha-8)] bg-[var(--alpha-2)]/70 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
                    <textarea
                      value={manualQuestion}
                      onChange={(event) => onManualQuestionChange(event.target.value)}
                      rows={2}
                      placeholder="Nhập câu hỏi hoặc chỉ cần bấm mic và nói..."
                      className="w-full resize-none bg-transparent text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {isRecording
                          ? 'Đang nghe. Bạn chỉ cần nói xong và ngừng một lúc ngắn.'
                          : isProcessing
                            ? 'Tutor đang xử lý lượt nói của bạn.'
                            : 'Giống chat messenger: bấm mic để nói hoặc gõ câu hỏi rồi gửi.'}
                      </p>
                      <Button
                        type="button"
                        onClick={() => void onSendManualQuestion()}
                        disabled={!manualQuestion.trim() || isSubmittingTurn}
                      >
                        <span className="flex items-center gap-2">
                          <SendHorizontal className="size-4" />
                          Gửi
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
