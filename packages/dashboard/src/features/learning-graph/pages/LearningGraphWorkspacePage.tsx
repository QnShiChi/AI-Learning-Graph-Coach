import { useMemo, useState } from 'react';
import { Button } from '@insforge/ui';
import {
  CreateLearningSessionDialog,
  LearningSessionCard,
  LearningSessionSpotlight,
} from '../components';
import { useLearningSessionLibrary } from '../hooks/useLearningSessionLibrary';
import { pickSpotlightSession } from '../lib/session-workspace';

export default function LearningGraphWorkspacePage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { sessions, spotlightSession, isLoading } = useLearningSessionLibrary();

  const activeSpotlight = spotlightSession ?? pickSpotlightSession(sessions);
  const librarySessions = useMemo(
    () =>
      activeSpotlight ? sessions.filter((item) => item.session.id !== activeSpotlight.session.id) : sessions,
    [activeSpotlight, sessions]
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">AI Learning Graph</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Workspace học tập theo session</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Quản lý nhiều lộ trình học, tiếp tục session đang dở, và mở nhanh overview hoặc graph
            của từng phiên.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Tạo session mới</Button>
      </header>

      {isLoading ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--alpha-4)]" />
          <div className="h-56 animate-pulse rounded-2xl bg-[var(--alpha-4)]" />
        </section>
      ) : activeSpotlight ? (
        <LearningSessionSpotlight item={activeSpotlight} />
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--alpha-8)] bg-card p-8">
          <h2 className="text-xl font-medium text-foreground">Chưa có session nào</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tạo session đầu tiên để bắt đầu xây dựng lộ trình học cá nhân hóa.
          </p>
          <Button className="mt-5" onClick={() => setIsCreateOpen(true)}>
            Tạo session mới
          </Button>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-foreground">Session library</h2>
          <p className="text-sm text-muted-foreground">{sessions.length} session</p>
        </div>

        {librarySessions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {librarySessions.map((item) => (
              <LearningSessionCard key={item.session.id} item={item} />
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <section className="rounded-xl border border-[var(--alpha-8)] bg-card p-5 text-sm text-muted-foreground">
            Session nổi bật hiện đang là phiên duy nhất của bạn. Tạo thêm session để quản lý nhiều
            lộ trình song song tại đây.
          </section>
        ) : null}
      </section>

      <CreateLearningSessionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
