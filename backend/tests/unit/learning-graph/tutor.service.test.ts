import { describe, expect, it, vi } from 'vitest';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

describe('TutorService', () => {
  it('builds an academic lesson package with structured mainLesson fields', async () => {
    const service = new TutorService();

    const result = await service.generateLessonPackage({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription:
        'Semantic HTML dùng các thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
      sourceText: `Các ý chính cần bám vào:
- semantic HTML giúp trình duyệt và công cụ hỗ trợ hiểu vai trò của từng vùng nội dung
- thẻ như header, main, section, article, nav, footer mô tả cấu trúc trang
- cấu trúc rõ ràng giúp bảo trì và accessibility tốt hơn`,
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(result.formatVersion).toBe(2);
    expect(result.mainLesson.definition.toLowerCase()).toContain('semantic');
    expect(result.mainLesson.importance.length).toBeGreaterThan(0);
    expect(result.mainLesson.corePoints.length).toBeGreaterThan(0);
    expect(result.mainLesson.technicalExample.toLowerCase()).toContain('header');
    expect(result.mainLesson.commonMisconceptions.length).toBeGreaterThan(0);
  });

  it('cleans generated explanations so they read like teaching content instead of chatbot copy', async () => {
    const service = new TutorService();
    Object.defineProperty(service, 'chatService', {
      value: {
        chat: vi.fn().mockResolvedValue({
          text: `Chào bạn! Chúng ta sẽ cùng nhau tìm hiểu về OOP nhé.

Chào bạn! Chúng ta sẽ cùng nhau tìm hiểu về OOP nhé.

**OOP là gì?**

OOP là cách tổ chức chương trình quanh object và class.

Đừng lo lắng nếu bạn chưa biết gì, chúng ta sẽ bắt đầu từ đầu.

OOP là cách tổ chức chương trình quanh object và class.`,
        }),
      },
    });

    const result = await service.generateExplanation({
      conceptName: 'OOP',
      conceptDescription: 'OOP tổ chức chương trình quanh object và class.',
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(result).not.toContain('Chào bạn');
    expect(result).not.toContain('Đừng lo lắng');
    expect(result).toContain('OOP là gì?');
    expect(result.match(/OOP là cách tổ chức chương trình quanh object và class\./g)?.length ?? 0).toBe(1);
  });
});
