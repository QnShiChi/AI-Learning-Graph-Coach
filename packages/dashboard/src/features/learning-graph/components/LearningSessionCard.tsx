import { Button } from '@insforge/ui';
import { useNavigate } from 'react-router-dom';
import type { LearningSessionLibraryItem } from '../lib/session-workspace';
import { getSessionPrimaryHref } from '../lib/session-workspace';

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function LearningSessionCard({ item }: { item: LearningSessionLibraryItem }) {
  const navigate = useNavigate();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(getSessionPrimaryHref(item))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(getSessionPrimaryHref(item));
        }
      }}
      className="cursor-pointer rounded-xl border border-[var(--alpha-8)] bg-card p-5 transition-colors duration-200 hover:border-[var(--alpha-12)] hover:bg-[var(--alpha-4)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium text-foreground">{item.session.goalTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {item.progress.completedCount}/{item.progress.totalCount} khái niệm hoàn thành
          </p>
        </div>
        <span className="rounded-full border border-[var(--alpha-8)] px-2.5 py-1 text-xs text-muted-foreground">
          {item.session.status}
        </span>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {item.currentConcept
          ? `Khái niệm hiện tại: ${item.currentConcept.displayName}`
          : 'Session này chưa có khái niệm hiện tại'}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Hoạt động gần nhất: {formatUpdatedAt(item.session.updatedAt)}
      </p>

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/dashboard/learning-graph/sessions/${item.session.id}/overview`);
          }}
        >
          Overview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/dashboard/learning-graph/sessions/${item.session.id}/graph`);
          }}
        >
          Graph
        </Button>
      </div>
    </article>
  );
}
