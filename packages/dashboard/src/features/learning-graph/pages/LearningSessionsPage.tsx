import { Button } from '@insforge/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LearningPathPanel } from '../components';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function LearningSessionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const { createSession, currentConcept, pathSnapshot, progress, isCreatingSession, session, isLoading } =
    useLearningSessions(sessionId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
      <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-6">
        <h1 className="text-2xl font-medium text-foreground">AI Learning Graph Coach</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nhap chu de hoc va tai lieu bo sung de tao lo trinh hoc ca nhan hoa cho mot nguoi hoc.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Vi du: Deep Learning"
            className="h-11 rounded-md border border-[var(--alpha-8)] bg-background px-3 text-sm text-foreground"
          />
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Dan ghi chu hoac bai viet ngan..."
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
            {isCreatingSession ? 'Dang tao lo trinh...' : 'Tao lo trinh hoc'}
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
                  : `Concept ${item.position + 1}`,
              pathState: item.pathState,
            }))}
            onSelect={(conceptId) =>
              navigate(`/dashboard/learning-graph/concepts/${conceptId}?sessionId=${session.id}`)
            }
          />
          <div className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
            <h2 className="text-lg font-medium text-foreground">Tong quan phien hoc</h2>
            <div className="mt-4 space-y-3 text-sm text-foreground">
              <p>Chu de: {session.goalTitle}</p>
              <p>
                Tien do: {progress.completedCount}/{progress.totalCount} concept
              </p>
              <p>Trang thai: {session.status}</p>
              <p>Concept hien tai: {currentConcept?.displayName ?? 'Chua co'}</p>
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
                  Tiep tuc hoc
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/dashboard/learning-graph/graph?sessionId=${session.id}`)}
              >
                Xem do thi
              </Button>
            </div>
            {isLoading ? <p className="mt-4 text-sm text-muted-foreground">Dang tai phien hoc...</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
