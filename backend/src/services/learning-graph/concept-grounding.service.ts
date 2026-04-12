export class ConceptGroundingService {
  extract(input: {
    conceptName: string;
    conceptDescription: string;
    siblingConceptNames: string[];
    sourceText: string | null;
  }) {
    const sourceText = input.sourceText?.trim() ?? '';

    if (!sourceText) {
      return {
        sourceExcerpt: input.conceptDescription,
        sourceHighlights: [input.conceptDescription].filter(Boolean),
        quality: 'weak' as const,
      };
    }

    const paragraphs = sourceText
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const conceptName = input.conceptName.toLowerCase();

    const matchingParagraph = paragraphs.find((paragraph) =>
      paragraph.toLowerCase().includes(conceptName)
    );

    if (matchingParagraph) {
      const highlights = matchingParagraph
        .split(/[.!?]\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter(
          (part) =>
            !input.siblingConceptNames.some((name) =>
              part.toLowerCase().includes(name.toLowerCase())
            )
        )
        .slice(0, 3);

      return {
        sourceExcerpt: matchingParagraph,
        sourceHighlights: highlights,
        quality: 'concept_specific' as const,
      };
    }

    return {
      sourceExcerpt: sourceText,
      sourceHighlights: sourceText
        .split(/[.!?]\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3),
      quality: 'session_level' as const,
    };
  }
}
