import { Button } from '@insforge/ui';
import { MessageCircleMore } from 'lucide-react';

interface VoiceTutorDockProps {
  badge: string;
  onOpen: () => void;
}

export function VoiceTutorDock({ badge, onOpen }: VoiceTutorDockProps) {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        type="button"
        onClick={onOpen}
        className="h-auto rounded-full px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
      >
        <span className="flex items-center gap-3">
          <MessageCircleMore className="size-4" />
          <span className="text-sm font-medium">Tutor giọng nói</span>
          <span className="rounded-full bg-black/15 px-2 py-1 text-[11px] text-white/90">
            {badge}
          </span>
        </span>
      </Button>
    </div>
  );
}
