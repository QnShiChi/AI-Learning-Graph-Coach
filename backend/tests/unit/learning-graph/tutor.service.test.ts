import { describe, expect, it, vi } from 'vitest';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

describe('TutorService', () => {
  it('retries when the first lesson output repeats the concept title and accepts the corrected retry', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition: 'HTML semantic và cấu trúc trang',
          importance: 'HTML semantic và cấu trúc trang',
          corePoints: ['HTML semantic và cấu trúc trang', 'HTML semantic và cấu trúc trang'],
          technicalExample: 'Hiểu vai trò của các thẻ như header, main, section.',
          commonMisconceptions: ['Không nên hiểu sai.'],
          prerequisiteMiniLessons: [],
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition:
            'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả đúng vai trò của từng vùng nội dung trên trang.',
          importance:
            'Nó giúp trình duyệt, công cụ hỗ trợ và lập trình viên hiểu cấu trúc trang rõ hơn khi đọc, bảo trì, và hỗ trợ accessibility.',
          corePoints: [
            'Các thẻ như header, nav, main, section, article, footer mang vai trò cấu trúc khác nhau.',
            'Nên chọn thẻ theo nghĩa của nội dung thay vì dùng div cho mọi trường hợp.',
          ],
          technicalExample:
            '<main><article><h1>Bài viết</h1><section>Nội dung chính</section></article></main>',
          commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div sang thẻ khác cho đẹp mã.'],
          prerequisiteMiniLessons: [],
        }),
      });

    const service = new TutorService({
      chatService: { chat } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
      sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.contentQuality).toBe('validated');
    expect(result.mainLesson.definition).toContain('Semantic HTML');
  });

  it('falls back to safe minimum content when every model attempt fails semantic validation', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        definition: 'HTML semantic và cấu trúc trang',
        importance: 'HTML semantic và cấu trúc trang',
        corePoints: ['HTML semantic và cấu trúc trang', 'HTML semantic và cấu trúc trang'],
        technicalExample: 'Hiểu vai trò của các thẻ như header, main, section.',
        commonMisconceptions: ['Không nên hiểu sai.'],
        prerequisiteMiniLessons: [],
      }),
    });

    const service = new TutorService({
      chatService: { chat } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
      sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledTimes(3);
    expect(result.contentQuality).toBe('fallback');
    expect(result.mainLesson.technicalExample).toContain('chưa được trích rõ');
  });

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
    expect(result.contentQuality).toBeDefined();
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
