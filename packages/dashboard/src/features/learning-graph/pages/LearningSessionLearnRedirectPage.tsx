import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLearningSessions } from '../hooks/useLearningSessions';

export default function LearningSessionLearnRedirectPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentConcept, isLoading } = useLearningSessions(sessionId);

  useEffect(() => {
    if (isLoading || !sessionId) {
      return;
    }

    if (currentConcept) {
      navigate(`/dashboard/learning-graph/sessions/${sessionId}/concepts/${currentConcept.id}`, {
        replace: true,
      });
      return;
    }

    navigate(`/dashboard/learning-graph/sessions/${sessionId}/overview`, {
      replace: true,
    });
  }, [currentConcept, isLoading, navigate, sessionId]);

  return (
    <section className="rounded-xl border border-[var(--alpha-8)] bg-card p-6 text-sm text-muted-foreground">
      Đang mở bước học phù hợp cho phiên này...
    </section>
  );
}
