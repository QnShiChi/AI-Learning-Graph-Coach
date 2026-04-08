export interface RawTextPackage {
  topic: string;
  sourceText: string | null;
  rawText: string;
}

export class InputNormalizationService {
  normalize(topic: string, sourceText?: string): RawTextPackage {
    const normalizedTopic = topic.trim();
    const normalizedSourceText = sourceText?.trim() ? sourceText.trim() : null;

    return {
      topic: normalizedTopic,
      sourceText: normalizedSourceText,
      rawText: normalizedSourceText
        ? `Chu de hoc: ${normalizedTopic}\n\nTai lieu bo sung:\n${normalizedSourceText}`
        : normalizedTopic,
    };
  }
}
