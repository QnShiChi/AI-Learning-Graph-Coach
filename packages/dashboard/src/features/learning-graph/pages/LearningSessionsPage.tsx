import { Button } from '@insforge/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LearningPathPanel } from '../components';
import { useLearningSessionLibrary } from '../hooks/useLearningSessionLibrary';
import { useLearningSessions } from '../hooks/useLearningSessions';

const sessionStatusLabels = {
  initializing: 'Đang khởi tạo',
  ready: 'Sẵn sàng',
  completed: 'Hoàn thành',
  failed: 'Lỗi',
} as const;

export default function LearningSessionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const { createSession, isCreatingSession } = useLearningSessionLibrary();
  const { currentConcept, pathSnapshot, progress, session, isLoading } = useLearningSessions(sessionId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
      <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-6">
        <h1 className="text-2xl font-medium text-foreground">Huấn luyện viên lộ trình học AI</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nhập chủ đề học và tài liệu bổ sung để tạo lộ trình học cá nhân hóa cho một người học.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Ví dụ: Deep Learning"
            className="h-11 rounded-md border border-[var(--alpha-8)] bg-background px-3 text-sm text-foreground"
          />
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Dán ghi chú hoặc bài viết ngắn..."
            className="min-h-40 rounded-md border border-[var(--alpha-8)] bg-background px-3 py-2 text-sm text-foreground"
          />
          <Button
            type="button"
            className="w-fit"
            onClick={async () => {
              const result = await createSession({ topic, sourceText });
              navigate(
                `/dashboard/learning-graph/concepts/${result.currentConcept.id}?sessionId=${result.session.id}`
              );
            }}
            disabled={isCreatingSession || !topic.trim()}
          >
            {isCreatingSession ? 'Đang tạo lộ trình...' : 'Tạo lộ trình học'}
          </Button>
        </div>
      </section>

      {session ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <LearningPathPanel
            items={pathSnapshot.map((item) => ({
              conceptId: item.conceptId,
              label:
                currentConcept?.id === item.conceptId
                  ? currentConcept.displayName
                  : `Khái niệm ${item.position + 1}`,
              pathState: item.pathState,
            }))}
            onSelect={(conceptId) =>
              navigate(`/dashboard/learning-graph/concepts/${conceptId}?sessionId=${session.id}`)
            }
          />
          <div className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
            <h2 className="text-lg font-medium text-foreground">Tổng quan phiên học</h2>
            <div className="mt-4 space-y-3 text-sm text-foreground">
              <p>Chủ đề: {session.goalTitle}</p>
              <p>
                Tiến độ: {progress.completedCount}/{progress.totalCount} khái niệm
              </p>
              <p>Trạng thái: {sessionStatusLabels[session.status]}</p>
              <p>Khái niệm hiện tại: {currentConcept?.displayName ?? 'Chưa có'}</p>
            </div>
            <div className="mt-4 flex gap-3">
              {currentConcept ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/dashboard/learning-graph/concepts/${currentConcept.id}?sessionId=${session.id}`
                    )
                  }
                >
                  Tiếp tục học
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/dashboard/learning-graph/graph?sessionId=${session.id}`)}
              >
                Xem đồ thị
              </Button>
            </div>
            {isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Đang tải phiên học...</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
