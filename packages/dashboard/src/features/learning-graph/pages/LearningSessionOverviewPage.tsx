import { Button } from '@insforge/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { LearningPathPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function LearningSessionOverviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, pathSnapshot, progress, currentConcept, isLoading } = useLearningSessions(sessionId);
  const { graph } = useConceptLearning(sessionId);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <LearningPathPanel
        items={pathSnapshot.map((item) => ({
          conceptId: item.conceptId,
          label:
            item.conceptId === currentConcept?.id
              ? currentConcept.displayName
              : `Khái niệm ${item.position + 1}`,
          pathState: item.pathState,
        }))}
        onSelect={(conceptId) =>
          navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${conceptId}`)
        }
      />

      <section className="rounded-xl border border-[var(--alpha-8)] bg-card p-5">
        <h2 className="text-lg font-medium text-foreground">
          {session?.status === 'completed' ? 'Tổng kết session' : 'Tổng quan tiến độ'}
        </h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang tải tổng quan phiên học...</p>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-foreground">
            <p>Chủ đề: {session?.goalTitle ?? 'Chưa có dữ liệu'}</p>
            <p>
              Tiến độ: {progress.completedCount}/{progress.totalCount}
            </p>
            <p>Khái niệm hiện tại: {currentConcept?.displayName ?? 'Không có'}</p>
            <p>Số concept trong graph: {graph.concepts.length}</p>
            <p>Số cạnh prerequisite: {graph.edges.length}</p>
          </div>
        )}
        <div className="mt-5 flex gap-3">
          {currentConcept ? (
            <Button
              onClick={() =>
                navigate(
                  `/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${currentConcept.id}`
                )
              }
            >
              Tiếp tục học
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/graph`)}
          >
            Xem đồ thị
          </Button>
        </div>
      </section>
    </div>
  );
}
