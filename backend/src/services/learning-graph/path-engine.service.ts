export interface PathSnapshotItem {
  conceptId: string;
  position: number;
  pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
}

export class PathEngineService {
  private static readonly MASTERY_THRESHOLD = 0.7;

  private hasPassedConcept(
    masteryByConceptId: Record<string, { masteryScore: number }>,
    conceptId: string
  ) {
    return (
      (masteryByConceptId[conceptId]?.masteryScore ?? 0) >= PathEngineService.MASTERY_THRESHOLD
    );
  }

  buildSnapshot(input: {
    concepts: Array<{ id: string; difficulty: number }>;
    masteryByConceptId: Record<string, { masteryScore: number }>;
    prerequisiteMap: Record<string, string[]>;
    nextPathVersion: number;
  }) {
    const ordered = [...input.concepts].sort((a, b) => a.difficulty - b.difficulty);
    const passedConceptIds = new Set(
      ordered
        .filter((concept) => this.hasPassedConcept(input.masteryByConceptId, concept.id))
        .map((concept) => concept.id)
    );
    const currentConceptId =
      ordered.find((concept) => {
        if (passedConceptIds.has(concept.id)) {
          return false;
        }

        const prerequisites = input.prerequisiteMap[concept.id] ?? [];
        return prerequisites.every((prerequisiteId) => passedConceptIds.has(prerequisiteId));
      })?.id ?? null;

    const nextConceptId =
      currentConceptId === null
        ? null
        : ordered.find((concept) => {
            if (concept.id === currentConceptId || passedConceptIds.has(concept.id)) {
              return false;
            }

            const prerequisites = input.prerequisiteMap[concept.id] ?? [];
            return prerequisites.every(
              (prerequisiteId) =>
                passedConceptIds.has(prerequisiteId) || prerequisiteId === currentConceptId
            );
          })?.id ?? null;

    const items: PathSnapshotItem[] = ordered.map((concept, index) => {
      let pathState: PathSnapshotItem['pathState'];

      if (passedConceptIds.has(concept.id)) {
        pathState = 'completed';
      } else if (concept.id === currentConceptId) {
        pathState = 'current';
      } else if (concept.id === nextConceptId) {
        pathState = 'next';
      } else {
        const prerequisites = input.prerequisiteMap[concept.id] ?? [];
        pathState = prerequisites.every((prerequisiteId) => passedConceptIds.has(prerequisiteId))
          ? 'upcoming'
          : 'locked';
      }

      return {
        conceptId: concept.id,
        position: index,
        pathState,
      };
    });

    return {
      pathVersion: input.nextPathVersion,
      items,
    };
  }

  getCurrentConceptId(snapshot: { items: PathSnapshotItem[] }) {
    return snapshot.items.find((item) => item.pathState === 'current')?.conceptId ?? null;
  }
}
