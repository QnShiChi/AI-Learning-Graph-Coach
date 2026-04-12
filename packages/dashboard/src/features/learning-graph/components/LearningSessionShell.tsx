import { Tabs, Tab } from '@insforge/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLearningSessions } from '../hooks/useLearningSessions';

function getActiveTab(pathname: string) {
  if (pathname.endsWith('/graph')) {
    return 'graph';
  }

  if (pathname.includes('/concepts/') || pathname.endsWith('/learn')) {
    return 'learn';
  }

  return 'overview';
}

export default function LearningSessionShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, progress } = useLearningSessions(sessionId);

  return (
    <div className="min-h-full w-full bg-semantic-0">
      <div className="flex w-full max-w-none flex-col gap-6 px-6 py-8 xl:px-8 2xl:px-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Learning Graph Workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {session?.goalTitle ?? 'Đang tải phiên học...'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.completedCount}/{progress.totalCount} khái niệm đã hoàn thành
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/learning-graph')}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Quay lại workspace
          </button>
        </div>

        <Tabs
          value={getActiveTab(location.pathname)}
          onValueChange={(value) =>
            navigate(`/dashboard/learning-graph/sessions/${sessionId ?? ''}/${value}`)
          }
          className="w-fit"
        >
          <Tab value="overview">Overview</Tab>
          <Tab value="learn">Learn</Tab>
          <Tab value="graph">Graph</Tab>
        </Tabs>

        <Outlet />
      </div>
    </div>
  );
}
