import type { LessonPackagePayload } from '../services/learning-graph.service';

export interface ConceptLessonSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

function compact(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function buildConceptLessonSections(
  mainLesson: LessonPackagePayload['mainLesson']
): ConceptLessonSection[] {
  return [
    {
      title: 'Khái niệm là gì',
      paragraphs: compact([mainLesson.definition]),
    },
    {
      title: 'Vì sao quan trọng',
      paragraphs: compact([mainLesson.importance]),
    },
    {
      title: 'Thành phần / quy tắc cốt lõi',
      bullets: compact(mainLesson.corePoints),
    },
    {
      title: 'Ví dụ minh họa đúng ngữ cảnh',
      paragraphs: compact([mainLesson.technicalExample]),
    },
    {
      title: 'Lỗi hiểu sai thường gặp',
      bullets: compact(mainLesson.commonMisconceptions),
    },
  ];
}
