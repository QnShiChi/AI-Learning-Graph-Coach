import { Button, Switch } from '@insforge/ui';
import type {
  GetLearningGraphResponseSchema,
  SessionConceptMasterySchema,
  SessionPathItemSchema,
} from '@insforge/shared-schemas';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../../lib/contexts/ThemeContext';
import { cn } from '../../../lib/utils/utils';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas';
import { KnowledgeGraphDetailPanel } from './KnowledgeGraphDetailPanel';
import { getKnowledgeGraphTheme } from '../lib/knowledge-graph-theme';
import {
  buildKnowledgeGraphViewModel,
  type KnowledgeGraphMode,
} from '../lib/knowledge-graph-view-model';

interface KnowledgeGraphPanelProps {
  sessionId: string;
  sessionTitle: string;
  progress: {
    completedCount: number;
    totalCount: number;
  };
  currentConceptId: string | null;
  graph: GetLearningGraphResponseSchema;
  pathSnapshot: SessionPathItemSchema[];
  isLoading: boolean;
  errorMessage?: string | null;
  masteryByConceptId?: Record<string, SessionConceptMasterySchema>;
  onBack: () => void;
  onOpenConcept: (conceptId: string) => void;
}

export function KnowledgeGraphPanel({
  sessionTitle,
  progress,
  currentConceptId,
  graph,
  pathSnapshot,
  isLoading,
  errorMessage,
  masteryByConceptId = {},
  onBack,
  onOpenConcept,
}: KnowledgeGraphPanelProps) {
  const { resolvedTheme } = useTheme();
  const graphTheme = useMemo(() => getKnowledgeGraphTheme(resolvedTheme), [resolvedTheme]);
  const [mode, setMode] = useState<KnowledgeGraphMode>('full');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(currentConceptId);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (!selectedConceptId && currentConceptId) {
      setSelectedConceptId(currentConceptId);
    }
  }, [currentConceptId, selectedConceptId]);

  useEffect(() => {
    if (selectedConceptId) {
      setIsPanelOpen(true);
    }
  }, [selectedConceptId]);

  const viewModel = useMemo(
    () =>
      buildKnowledgeGraphViewModel({
        graph,
        pathSnapshot,
        currentConceptId,
        selectedConceptId,
        mode,
        masteryByConceptId,
      }),
    [currentConceptId, graph, masteryByConceptId, mode, pathSnapshot, selectedConceptId]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[24px] border border-[var(--alpha-8)] bg-card/75 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Knowledge map
          </p>
          <h1 className="mt-2 truncate text-2xl font-semibold text-foreground">{sessionTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.completedCount}/{progress.totalCount} concept da hoan thanh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-[var(--alpha-8)] bg-[var(--alpha-2)] px-3 py-2 text-sm text-foreground">
            <span>Toan bo graph</span>
            <Switch
              checked={mode === 'path'}
              onCheckedChange={(checked) => setMode(checked ? 'path' : 'full')}
              size="sm"
              aria-label="Toggle path only graph mode"
            />
            <span>Chi duong hoc de xuat</span>
          </div>

          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Ve tong quan</span>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[620px] rounded-[28px] border border-[var(--alpha-8)] bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6">
            <div className="grid h-full place-items-center rounded-[22px] border border-dashed border-white/10 text-sm text-slate-300">
              Dang dung knowledge map...
            </div>
          </div>
          <KnowledgeGraphDetailPanel
            viewModel={viewModel}
            selectedConceptId={null}
            isOpen
            onOpenChange={setIsPanelOpen}
            theme={graphTheme}
            onOpenConcept={() => undefined}
          />
        </div>
      ) : errorMessage ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid h-[620px] place-items-center rounded-[28px] border border-[var(--alpha-8)] bg-card p-6">
            <div className="max-w-md text-center">
              <h2 className="text-lg font-semibold text-foreground">Khong tai duoc knowledge map</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
              <div className="mt-4">
                <Button type="button" variant="outline" onClick={onBack}>
                  Ve tong quan
                </Button>
              </div>
            </div>
          </div>
          <KnowledgeGraphDetailPanel
            viewModel={viewModel}
            selectedConceptId={null}
            isOpen
            onOpenChange={setIsPanelOpen}
            theme={graphTheme}
            onOpenConcept={() => undefined}
          />
        </div>
      ) : viewModel.nodes.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--alpha-8)] bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Chua co graph de hien thi</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Session nay chua co concept hoac prerequisite relation de truc quan hoa.
          </p>
          <div className="mt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Ve tong quan
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-6',
            isPanelOpen
              ? 'xl:grid-cols-[minmax(0,1fr)_340px]'
              : 'xl:grid-cols-[minmax(0,1fr)_56px]'
          )}
        >
          <KnowledgeGraphCanvas viewModel={viewModel} onSelectNode={setSelectedConceptId} />
          <div className="xl:sticky xl:top-6 xl:self-start">
            <KnowledgeGraphDetailPanel
              viewModel={viewModel}
              selectedConceptId={selectedConceptId}
              isOpen={isPanelOpen}
              onOpenChange={setIsPanelOpen}
              theme={graphTheme}
              onOpenConcept={() => {
                if (selectedConceptId) {
                  onOpenConcept(selectedConceptId);
                }
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
