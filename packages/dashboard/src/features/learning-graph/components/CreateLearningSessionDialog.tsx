import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@insforge/ui';
import { useLearningSessionLibrary } from '../hooks/useLearningSessionLibrary';

interface CreateLearningSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLearningSessionDialog({
  open,
  onOpenChange,
}: CreateLearningSessionDialogProps) {
  const { createSession, isCreatingSession } = useLearningSessionLibrary();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!topic.trim()) {
      setError('Chủ đề học là bắt buộc.');
      return;
    }

    try {
      await createSession({
        topic: topic.trim(),
        sourceText: sourceText.trim() || undefined,
      });
      setTopic('');
      setSourceText('');
      setError('');
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể tạo phiên học.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 h-dvh w-full max-w-[min(560px,100vw)] translate-x-0 translate-y-0 rounded-none border-l border-[var(--alpha-8)]"
      >
        <form onSubmit={(event) => void handleSubmit(event)} className="flex h-full flex-col">
          <DialogHeader>
            <DialogTitle>Tạo session mới</DialogTitle>
            <DialogDescription>
              Nhập chủ đề học và tài liệu nguồn để tạo lộ trình mới.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex-1 gap-5">
            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span>Chủ đề học</span>
              <input
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setError('');
                }}
                placeholder="Ví dụ: Deep Learning"
                className="h-11 rounded-lg border border-[var(--alpha-8)] bg-background px-3"
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-foreground">
              <span>Tài liệu nguồn</span>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Dán ghi chú, bài viết ngắn, hoặc tóm tắt tài liệu..."
                className="min-h-48 rounded-lg border border-[var(--alpha-8)] bg-background px-3 py-3"
              />
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isCreatingSession || !topic.trim()}>
              {isCreatingSession ? 'Đang tạo...' : 'Tạo session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
