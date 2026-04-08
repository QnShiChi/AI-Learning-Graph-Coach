export interface DraftConcept {
  tempId: string;
  displayName: string;
  canonicalName: string;
  description: string;
  difficulty: number;
}

export interface DraftEdge {
  fromTempId: string;
  toTempId: string;
  type: 'prerequisite';
  weight: number;
}

export interface ValidatedGraph {
  sessionGoal: string;
  concepts: DraftConcept[];
  edges: DraftEdge[];
  validationReport: {
    removedSelfLoops: number;
  };
}

export class GraphValidationService {
  validate(input: {
    sessionGoal: string;
    concepts: DraftConcept[];
    edges: DraftEdge[];
  }): ValidatedGraph {
    const canonicalMap = new Map<string, DraftConcept>();
    let removedSelfLoops = 0;

    for (const concept of input.concepts) {
      const canonicalName = concept.canonicalName.trim().toLowerCase();
      if (!canonicalMap.has(canonicalName)) {
        canonicalMap.set(canonicalName, {
          ...concept,
          canonicalName,
        });
      }
    }

    const validConceptIds = new Set(Array.from(canonicalMap.values()).map((concept) => concept.tempId));
    const edges = input.edges.filter((edge) => {
      if (edge.fromTempId === edge.toTempId) {
        removedSelfLoops += 1;
        return false;
      }

      return validConceptIds.has(edge.fromTempId) && validConceptIds.has(edge.toTempId);
    });

    return {
      sessionGoal: input.sessionGoal,
      concepts: Array.from(canonicalMap.values()),
      edges,
      validationReport: {
        removedSelfLoops,
      },
    };
  }
}
