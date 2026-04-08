export interface PathSnapshotItem {
  conceptId: string;
  position: number;
  pathState: 'completed' | 'current' | 'next' | 'upcoming' | 'locked';
}

export class PathEngineService {
  buildSnapshot(input: {
    concepts: Array<{ id: string; difficulty: number }>;
    masteryByConceptId: Record<string, { masteryScore: number }>;
    prerequisiteMap: Record<string, string[]>;
    nextPathVersion: number;
  }) {
    const ordered = [...input.concepts].sort((a, b) => a.difficulty - b.difficulty);
    const firstUnmetIndex = ordered.findIndex(
      (concept) => (input.masteryByConceptId[concept.id]?.masteryScore ?? 0) < 0.85
    );

    const items: PathSnapshotItem[] = ordered.map((concept, index) => {
      let pathState: PathSnapshotItem['pathState'] = 'upcoming';

      if (firstUnmetIndex === -1 || index < firstUnmetIndex) {
        pathState = 'completed';
      } else if (index === firstUnmetIndex) {
        pathState = 'current';
      } else if (index === firstUnmetIndex + 1) {
        pathState = 'next';
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
}
