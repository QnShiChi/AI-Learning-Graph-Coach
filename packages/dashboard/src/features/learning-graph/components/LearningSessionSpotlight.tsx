import { Button } from '@insforge/ui';
import { useNavigate } from 'react-router-dom';
import type { LearningSessionLibraryItem } from '../lib/session-workspace';
import { getSessionPrimaryHref } from '../lib/session-workspace';

export function LearningSessionSpotlight({ item }: { item: LearningSessionLibraryItem }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-[var(--alpha-8)] bg-[linear-gradient(135deg,rgba(34,197,94,0.10),rgba(59,130,246,0.08))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Tiếp tục học</p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">{item.session.goalTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {item.currentConcept
          ? `Khái niệm hiện tại: ${item.currentConcept.displayName}`
          : 'Session này đã hoàn thành. Mở overview để xem lại tiến độ và cấu trúc lộ trình.'}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--alpha-8)] bg-white/50 p-4">
          <p className="text-xs text-muted-foreground">Tiến độ</p>
          <p className="mt-1 text-lg font-medium text-foreground">
            {item.progress.completedCount}/{item.progress.totalCount}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--alpha-8)] bg-white/50 p-4">
          <p className="text-xs text-muted-foreground">Trạng thái</p>
          <p className="mt-1 text-lg font-medium text-foreground">{item.session.status}</p>
        </div>
        <div className="rounded-xl border border-[var(--alpha-8)] bg-white/50 p-4">
          <p className="text-xs text-muted-foreground">Goal</p>
          <p className="mt-1 truncate text-lg font-medium text-foreground">{item.session.goalTitle}</p>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => navigate(getSessionPrimaryHref(item))}>
          {item.session.status === 'completed' ? 'Xem tổng quan' : 'Tiếp tục học'}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/dashboard/learning-graph/sessions/${item.session.id}/graph`)}
        >
          Xem đồ thị
        </Button>
      </div>
    </section>
  );
}
