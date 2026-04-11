import { useNavigate, useParams } from 'react-router-dom';
import { KnowledgeGraphPanel } from '../components';
import { useConceptLearning } from '../hooks/useConceptLearning';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { graph, isLoadingGraph } = useConceptLearning(sessionId);
  const { session, pathSnapshot, progress, currentConcept, isLoading, error } = useLearningSessions(sessionId);

  return (
    <KnowledgeGraphPanel
      sessionId={sessionId ?? ''}
      sessionTitle={session?.goalTitle ?? 'Do thi kien thuc'}
      progress={progress}
      currentConceptId={currentConcept?.id ?? session?.currentConceptId ?? null}
      graph={graph}
      pathSnapshot={pathSnapshot}
      isLoading={isLoadingGraph || isLoading}
      errorMessage={error instanceof Error ? error.message : null}
      onBack={() => navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/overview`)}
      onOpenConcept={(conceptId) =>
        navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/concepts/${conceptId}`)
      }
    />
  );
}
