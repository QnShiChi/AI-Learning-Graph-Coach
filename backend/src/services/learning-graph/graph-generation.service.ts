import { ChatCompletionService } from '@/services/ai/chat-completion.service.js';
import type { ChatMessageSchema } from '@insforge/shared-schemas';

export class GraphGenerationService {
  private chatService = ChatCompletionService.getInstance();

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  private normalizeConcepts(concepts: unknown[]) {
    return concepts
      .map((concept, index) => {
        if (typeof concept === 'string') {
          const displayName = concept.trim();
          if (!displayName) {
            return null;
          }

          return {
            tempId: `concept-${index + 1}`,
            displayName,
            canonicalName: displayName.toLowerCase(),
            description: '',
            difficulty: 0.5,
          };
        }

        if (!concept || typeof concept !== 'object') {
          return null;
        }

        const candidate = concept as Record<string, unknown>;
        const displayName =
          typeof candidate.displayName === 'string'
            ? candidate.displayName.trim()
            : typeof candidate.label === 'string'
              ? candidate.label.trim()
              : typeof candidate.title === 'string'
                ? candidate.title.trim()
                : typeof candidate.concept === 'string'
                  ? candidate.concept.trim()
                  : typeof candidate.name === 'string'
                    ? candidate.name.trim()
                    : '';

        const canonicalName =
          typeof candidate.canonicalName === 'string' && candidate.canonicalName.trim().length > 0
            ? candidate.canonicalName.trim().toLowerCase()
            : displayName.toLowerCase();

        if (!displayName || !canonicalName) {
          return null;
        }

        return {
          tempId:
            typeof candidate.tempId === 'string' && candidate.tempId.trim().length > 0
              ? candidate.tempId.trim()
              : typeof candidate.id === 'string' && candidate.id.trim().length > 0
                ? candidate.id.trim()
              : `concept-${index + 1}`,
          displayName,
          canonicalName,
          description:
            typeof candidate.description === 'string' ? candidate.description.trim() : '',
          difficulty:
            typeof candidate.difficulty === 'number' && Number.isFinite(candidate.difficulty)
              ? Math.max(0, Math.min(1, candidate.difficulty))
              : 0.5,
        };
      })
      .filter((concept): concept is NonNullable<typeof concept> => concept !== null);
  }

  private normalizeEdges(
    edges: unknown[],
    concepts: Array<{ tempId: string; canonicalName: string; displayName: string }>,
    rawConcepts: unknown[]
  ) {
    const conceptIdByName = new Map<string, string>();

    for (const concept of concepts) {
      conceptIdByName.set(concept.tempId, concept.tempId);
      conceptIdByName.set(concept.canonicalName, concept.tempId);
      conceptIdByName.set(concept.displayName.toLowerCase(), concept.tempId);
      conceptIdByName.set(this.slugify(concept.displayName), concept.tempId);
    }

    const normalizedEdges = edges
      .map((edge) => {
        if (!edge || typeof edge !== 'object') {
          return null;
        }

        const candidate = edge as Record<string, unknown>;
        const rawFrom =
          typeof candidate.fromTempId === 'string'
            ? candidate.fromTempId.trim()
            : typeof candidate.from === 'string'
              ? candidate.from.trim()
              : typeof candidate.source === 'string'
                ? candidate.source.trim()
                : '';
        const rawTo =
          typeof candidate.toTempId === 'string'
            ? candidate.toTempId.trim()
            : typeof candidate.to === 'string'
              ? candidate.to.trim()
              : typeof candidate.target === 'string'
                ? candidate.target.trim()
                : '';

        const fromTempId =
          conceptIdByName.get(rawFrom) ??
          conceptIdByName.get(rawFrom.toLowerCase()) ??
          conceptIdByName.get(this.slugify(rawFrom)) ??
          '';
        const toTempId =
          conceptIdByName.get(rawTo) ??
          conceptIdByName.get(rawTo.toLowerCase()) ??
          conceptIdByName.get(this.slugify(rawTo)) ??
          '';

        if (!fromTempId || !toTempId) {
          return null;
        }

        return {
          fromTempId,
          toTempId,
          type: 'prerequisite' as const,
          weight:
            typeof candidate.weight === 'number' && Number.isFinite(candidate.weight)
              ? Math.max(0, Math.min(1, candidate.weight))
              : 0.5,
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    for (const rawConcept of rawConcepts) {
      if (!rawConcept || typeof rawConcept !== 'object') {
        continue;
      }

      const candidate = rawConcept as Record<string, unknown>;
      const conceptKey =
        typeof candidate.tempId === 'string'
          ? candidate.tempId
          : typeof candidate.id === 'string'
            ? candidate.id
            : typeof candidate.displayName === 'string'
              ? candidate.displayName
              : typeof candidate.label === 'string'
                ? candidate.label
                : typeof candidate.title === 'string'
                  ? candidate.title
                  : typeof candidate.name === 'string'
                    ? candidate.name
                    : '';

      const toTempId =
        conceptIdByName.get(conceptKey) ??
        conceptIdByName.get(conceptKey.toLowerCase()) ??
        conceptIdByName.get(this.slugify(conceptKey)) ??
        '';

      if (!toTempId || !Array.isArray(candidate.prerequisites)) {
        continue;
      }

      for (const prerequisite of candidate.prerequisites) {
        if (typeof prerequisite !== 'string') {
          continue;
        }

        const fromTempId =
          conceptIdByName.get(prerequisite) ??
          conceptIdByName.get(prerequisite.toLowerCase()) ??
          conceptIdByName.get(this.slugify(prerequisite)) ??
          '';

        if (!fromTempId) {
          continue;
        }

        normalizedEdges.push({
          fromTempId,
          toTempId,
          type: 'prerequisite' as const,
          weight: 0.5,
        });
      }
    }

    return normalizedEdges;
  }

  parseGraphResponse(text: string) {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const normalized = fenceMatch?.[1]?.trim() ?? trimmed;
    const parsed = JSON.parse(normalized || '{}') as Record<string, unknown>;
    const rawConcepts = Array.isArray(parsed.concepts) ? parsed.concepts : [];
    const concepts = this.normalizeConcepts(rawConcepts);

    return {
      sessionGoal:
        typeof parsed.sessionGoal === 'string' && parsed.sessionGoal.trim().length > 0
          ? parsed.sessionGoal.trim()
          : 'Learning Session',
      concepts,
      edges: this.normalizeEdges(Array.isArray(parsed.edges) ? parsed.edges : [], concepts, rawConcepts),
    };
  }

  async generate(rawText: string) {
    const messages: ChatMessageSchema[] = [
      {
        role: 'user',
        content: `Đọc nội dung sau và trả về DUY NHẤT một JSON hợp lệ theo schema này:
{
  "sessionGoal": "string",
  "concepts": [
    {
      "tempId": "c1",
      "displayName": "string",
      "canonicalName": "string",
      "description": "string",
      "difficulty": 0.5
    }
  ],
  "edges": [
    {
      "fromTempId": "c1",
      "toTempId": "c2",
      "type": "prerequisite",
      "weight": 0.7
    }
  ]
}

Yêu cầu:
- concepts phải có ít nhất 3 phần tử nếu nội dung đủ thông tin
- mọi edge phải dùng tempId đã khai báo trong concepts
- difficulty nằm trong khoảng 0 đến 1
- không bọc JSON trong markdown hay giải thích thêm

Nội dung đầu vào:
${rawText}`,
      },
    ];

    const result = await this.chatService.chat(messages, {
      model: 'google/gemini-2.0-flash-lite-001',
      temperature: 0.2,
    });

    return this.parseGraphResponse(result.text || '{}');
  }
}
