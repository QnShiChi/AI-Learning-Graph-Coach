export class ConceptGroundingService {
  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripListMarker(value: string) {
    return value
      .replace(/^\s*(?:[-*•]+|\d+[.)]?|[A-Za-z][.)])\s*/u, '')
      .trim();
  }

  private isHeadingOnly(value: string, conceptName: string, siblingConceptNames: string[]) {
    const normalizedValue = this.normalize(value);

    if (!normalizedValue || /^\d+$/.test(normalizedValue)) {
      return true;
    }

    if (normalizedValue === this.normalize(conceptName)) {
      return true;
    }

    return siblingConceptNames.some(
      (siblingConceptName) => normalizedValue === this.normalize(siblingConceptName)
    );
  }

  private buildHighlights(input: {
    lines: string[];
    conceptName: string;
    siblingConceptNames: string[];
  }) {
    const highlights: string[] = [];

    for (const line of input.lines) {
      const sentences = line
        .split(/(?<=[.!?…])\s+/)
        .map((sentence) => this.stripListMarker(sentence))
        .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      for (const sentence of sentences) {
        const normalizedSentence = this.normalize(sentence);
        if (
          this.isHeadingOnly(sentence, input.conceptName, input.siblingConceptNames) ||
          input.siblingConceptNames.some((name) =>
            normalizedSentence.includes(this.normalize(name))
          ) ||
          sentence.length < 24
        ) {
          continue;
        }

        highlights.push(sentence);
      }
    }

    return Array.from(new Set(highlights)).slice(0, 3);
  }

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

    const conceptName = this.normalize(input.conceptName);

    const matchingParagraph = paragraphs.find((paragraph) =>
      this.normalize(paragraph).includes(conceptName)
    );

    if (matchingParagraph) {
      const cleanedLines = matchingParagraph
        .split(/\r?\n/)
        .map((line) => this.stripListMarker(line))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const excerptLines = cleanedLines.filter(
        (line) => !this.isHeadingOnly(line, input.conceptName, input.siblingConceptNames)
      );
      const sourceExcerpt = (excerptLines.length > 0 ? excerptLines : cleanedLines).join('\n');
      const highlights = this.buildHighlights({
        lines: excerptLines.length > 0 ? excerptLines : cleanedLines,
        conceptName: input.conceptName,
        siblingConceptNames: input.siblingConceptNames,
      });

      return {
        sourceExcerpt,
        sourceHighlights: highlights.length > 0 ? highlights : [sourceExcerpt].filter(Boolean),
        quality: 'concept_specific' as const,
      };
    }

    const sessionLevelHighlights = this.buildHighlights({
      lines: sourceText.split(/\r?\n/),
      conceptName: input.conceptName,
      siblingConceptNames: input.siblingConceptNames,
    });

    return {
      sourceExcerpt: sourceText,
      sourceHighlights: sessionLevelHighlights,
      quality: 'session_level' as const,
    };
  }
}
