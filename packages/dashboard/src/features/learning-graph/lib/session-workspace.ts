import type { GetLearningSessionLibraryResponseSchema } from '@insforge/shared-schemas';

export type LearningSessionLibraryItem = GetLearningSessionLibraryResponseSchema['sessions'][number];

export function getSessionPrimaryHref(item: LearningSessionLibraryItem) {
  return item.session.status === 'completed'
    ? `/dashboard/learning-graph/sessions/${item.session.id}/overview`
    : `/dashboard/learning-graph/sessions/${item.session.id}/learn`;
}

export function pickSpotlightSession(items: LearningSessionLibraryItem[]) {
  return (
    [...items].sort(
      (left, right) => Date.parse(right.session.updatedAt) - Date.parse(left.session.updatedAt)
    )[0] ?? null
  );
}
