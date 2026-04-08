interface KnowledgeGraphPanelProps {
  concepts: Array<{ id: string; displayName: string; difficulty: number }>;
  edges: Array<{ fromConceptId: string; toConceptId: string; weight: number }>;
}

export function KnowledgeGraphPanel({ concepts, edges }: KnowledgeGraphPanelProps) {
  const conceptNameById = new Map(concepts.map((concept) => [concept.id, concept.displayName]));

  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <h2 className="text-lg font-medium text-foreground">Do thi kien thuc</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Man hinh nay dung de giai thich prerequisite va quan he giua cac concept.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--alpha-8)] p-4">
          <h3 className="text-sm font-medium text-foreground">Concepts</h3>
          <div className="mt-3 space-y-2">
            {concepts.map((concept) => (
              <div
                key={concept.id}
                className="flex items-center justify-between rounded-md bg-[var(--alpha-4)] px-3 py-2"
              >
                <span className="text-sm text-foreground">{concept.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  Do kho {Math.round(concept.difficulty * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[var(--alpha-8)] p-4">
          <h3 className="text-sm font-medium text-foreground">Prerequisite</h3>
          <div className="mt-3 space-y-2">
            {edges.map((edge, index) => (
              <div
                key={`${edge.fromConceptId}-${edge.toConceptId}-${index}`}
                className="rounded-md bg-[var(--alpha-4)] px-3 py-2 text-sm text-foreground"
              >
                {conceptNameById.get(edge.fromConceptId) ?? edge.fromConceptId} {' -> '}{' '}
                {conceptNameById.get(edge.toConceptId) ?? edge.toConceptId}
              </div>
            ))}
            {edges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chua co canh prerequisite nao.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
