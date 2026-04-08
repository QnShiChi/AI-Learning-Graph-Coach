import { Button } from '@insforge/ui';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KnowledgeGraphPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const { graph, isLoadingGraph } = useConceptLearning(sessionId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Đồ thị kiến thức</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Màn hình này dùng để trực quan hóa prerequisite và lộ trình học, không phải điều hướng chính.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/dashboard/learning-graph${sessionId ? `?sessionId=${sessionId}` : ''}`)}
        >
          Về tổng quan
        </Button>
      </div>

      {isLoadingGraph ? (
        <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5 text-sm text-muted-foreground">
          Đang tải đồ thị kiến thức...
        </section>
      ) : (
        <KnowledgeGraphPanel concepts={graph.concepts} edges={graph.edges} />
      )}
    </div>
  );
}
