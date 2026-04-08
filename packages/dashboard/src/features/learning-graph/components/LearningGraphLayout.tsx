import { Outlet } from 'react-router-dom';

export default function LearningGraphLayout() {
  return (
    <div className="min-h-full bg-[rgb(var(--semantic-1))]">
      <Outlet />
    </div>
  );
}
