import { Button } from '@insforge/ui';
import { useMemo, useState } from 'react';

interface ConceptExplanationCardProps {
  title?: string;
  explanation: string;
  prerequisites: string[];
  onGenerate: () => void | Promise<unknown>;
  isLoading: boolean;
}

export function ConceptExplanationCard(props: ConceptExplanationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedExplanation = useMemo(
    () =>
      props.explanation
        .split(/\n+/)
        .map((part) => part.trim())
        .filter((part) => {
          const normalized = part.toLowerCase();
          return !(
            normalized.startsWith('chào bạn') ||
            normalized.startsWith('xin chào') ||
            normalized.startsWith('đừng lo lắng') ||
            normalized.startsWith('chúc bạn học tốt')
          );
        })
        .join('\n\n'),
    [props.explanation]
  );
  const paragraphs = useMemo(
    () =>
      normalizedExplanation
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean),
    [normalizedExplanation]
  );
  const summary = paragraphs[0] ?? '';
  const keyIdeas = useMemo(
    () =>
      normalizedExplanation
        .match(/[^.!?]+[.!?]?/g)
        ?.map((part) => part.trim())
        .filter(
          (part, index, array) =>
            Boolean(part) && array.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index
        )
        .slice(0, 3) ?? [],
    [normalizedExplanation]
  );

  return (
    <section className="rounded-[20px] border border-[var(--alpha-8)] bg-card/80 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Hỗ trợ khi cần
          </p>
          <h2 className="text-lg font-medium text-foreground">
            {props.title ?? 'Cần nghe giải thích lại?'}
          </h2>
        </div>
        <Button type="button" variant="outline" onClick={() => void props.onGenerate()}>
          {props.isLoading ? 'Đang tạo...' : 'Giải thích lại'}
        </Button>
      </div>
      {props.prerequisites.length > 0 ? (
        <div className="mt-4 rounded-xl bg-[var(--alpha-4)] p-3 text-sm leading-6 text-muted-foreground">
          Cần nắm trước: {props.prerequisites.join(', ')}
        </div>
      ) : null}

      {props.explanation ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-[var(--alpha-4)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Bản ngắn gọn
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">{summary}</p>
          </div>

          {keyIdeas.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Ý chính
              </p>
              <div className="space-y-2">
                {keyIdeas.map((idea, index) => (
                  <div key={`${idea}-${index}`} className="rounded-xl border border-[var(--alpha-8)] p-3">
                    <p className="text-sm leading-6 text-foreground">{idea}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div />
            <Button type="button" variant="outline" onClick={() => setIsExpanded((value) => !value)}>
              {isExpanded ? 'Thu gọn' : 'Xem đầy đủ'}
            </Button>
          </div>

          {isExpanded ? (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--alpha-8)] bg-[var(--alpha-2)] p-4">
              <div className="space-y-4">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${paragraph}-${index}`} className="text-sm leading-7 text-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--alpha-8)] p-4 text-sm leading-7 text-muted-foreground">
          Chưa có nội dung giải thích.
        </div>
      )}
    </section>
  );
}
