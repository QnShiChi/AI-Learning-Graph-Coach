import { describe, expect, it } from 'vitest';
import { buildConceptLessonSections } from '../concept-lesson-content';

describe('buildConceptLessonSections', () => {
  it('maps mainLesson into academic sections without metaphor blocks', () => {
    const result = buildConceptLessonSections({
      definition: 'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
      importance: 'Giúp accessibility và maintainability tốt hơn.',
      corePoints: ['header và footer có vai trò riêng.', 'main chứa nội dung chính.'],
      technicalExample: '<main><article><h1>Tiêu đề</h1></article></main>',
      commonMisconceptions: ['Semantic HTML không chỉ là đổi div thành section.'],
    });

    expect(result.map((section) => section.title)).toEqual([
      'Khái niệm là gì',
      'Vì sao quan trọng',
      'Thành phần / quy tắc cốt lõi',
      'Ví dụ kỹ thuật đúng ngữ cảnh',
      'Lỗi hiểu sai thường gặp',
    ]);
  });
});
