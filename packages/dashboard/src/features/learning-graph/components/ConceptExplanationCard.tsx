import { Button } from '@insforge/ui';

interface ConceptExplanationCardProps {
  title: string;
  explanation: string;
  prerequisites: string[];
  onGenerate: () => void | Promise<unknown>;
  isLoading: boolean;
}

export function ConceptExplanationCard(props: ConceptExplanationCardProps) {
  return (
    <section className="rounded-lg border border-[var(--alpha-8)] bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">{props.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Giai thich duoc sinh bang tieng Viet theo concept hien tai.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void props.onGenerate()}>
          {props.isLoading ? 'Dang tao...' : 'Tao giai thich'}
        </Button>
      </div>
      {props.prerequisites.length > 0 ? (
        <div className="mt-4 rounded-md bg-[var(--alpha-4)] p-3 text-sm text-muted-foreground">
          Can nam truoc: {props.prerequisites.join(', ')}
        </div>
      ) : null}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {props.explanation || 'Chua co giai thich. Bam nut de tao noi dung hoc cho concept nay.'}
      </p>
    </section>
  );
}
