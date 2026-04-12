import { describe, expect, it, vi } from 'vitest';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

const componentGrounding = {
  sourceExcerpt:
    'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng. Mỗi component nên đại diện cho một phần UI độc lập như button, form, card, modal, navbar hoặc task item.',
  sourceHighlights: [
    'Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.',
    'Mỗi component nên đại diện cho một phần UI độc lập như button, form, card, modal, navbar hoặc task item.',
  ],
  quality: 'concept_specific' as const,
};

const semanticGrounding = {
  sourceExcerpt:
    'Semantic HTML là cách dùng các thẻ có ý nghĩa như header, nav, main, section, article, aside, footer để mô tả đúng vai trò của từng phần nội dung trên trang.',
  sourceHighlights: [
    'Semantic HTML là cách dùng các thẻ có ý nghĩa như header, nav, main, section, article, aside, footer.',
    'Các thẻ semantic mô tả đúng vai trò của từng phần nội dung trên trang.',
  ],
  quality: 'concept_specific' as const,
};

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
      grounding: semanticGrounding,
      sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
      siblingConceptNames: ['CSS layout và responsive design', 'JavaScript nền tảng'],
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
      grounding: semanticGrounding,
      sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
      siblingConceptNames: ['CSS layout và responsive design', 'JavaScript nền tảng'],
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledTimes(3);
    expect(result.contentQuality).toBe('fallback');
    expect(result.mainLesson.technicalExample).toContain('chưa được trích rõ');
  });

  it('rejects descriptive technicalExample text that is not a concrete example', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition:
            'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả vai trò của từng phần nội dung.',
          importance:
            'Nó giúp trình duyệt và công cụ hỗ trợ hiểu cấu trúc trang tốt hơn.',
          corePoints: [
            'header, main, article, section, footer mang vai trò khác nhau.',
            'Nên chọn thẻ theo nghĩa nội dung thay vì dùng div cho mọi thứ.',
          ],
          technicalExample:
            'Hiểu vai trò của các thẻ như header, main, section, article, nav, footer.',
          commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
          prerequisiteMiniLessons: [],
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition:
            'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả vai trò của từng phần nội dung.',
          importance:
            'Nó giúp trình duyệt và công cụ hỗ trợ hiểu cấu trúc trang tốt hơn.',
          corePoints: [
            'header, main, article, section, footer mang vai trò khác nhau.',
            'Nên chọn thẻ theo nghĩa nội dung thay vì dùng div cho mọi thứ.',
          ],
          technicalExample:
            '<header>...menu...</header><main><article><h1>Bài viết</h1></article></main>',
          commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
          prerequisiteMiniLessons: [],
        }),
      });

    const service = new TutorService({
      chatService: { chat } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription: 'Semantic HTML mô tả đúng ý nghĩa của từng phần nội dung.',
      grounding: semanticGrounding,
      sourceText: 'header, nav, main, article, section, footer; accessibility; maintainability',
      siblingConceptNames: ['CSS layout và responsive design', 'JavaScript nền tảng'],
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.mainLesson.technicalExample).toContain('<header>');
  });

  it('builds an academic lesson package with structured mainLesson fields', async () => {
    const service = new TutorService({
      chatService: {
        chat: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            definition:
              'Semantic HTML là cách dùng các thẻ có ý nghĩa để mô tả đúng vai trò của từng phần nội dung trên trang.',
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
        }),
      } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription:
        'Semantic HTML dùng các thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
      grounding: semanticGrounding,
      sourceText: `Các ý chính cần bám vào:
- semantic HTML giúp trình duyệt và công cụ hỗ trợ hiểu vai trò của từng vùng nội dung
- thẻ như header, main, section, article, nav, footer mô tả cấu trúc trang
- cấu trúc rõ ràng giúp bảo trì và accessibility tốt hơn`,
      siblingConceptNames: ['CSS layout và responsive design', 'JavaScript nền tảng'],
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(result.formatVersion).toBe(2);
    expect(result.contentQuality).toBeDefined();
    expect(result.mainLesson.definition.toLowerCase()).toContain('semantic');
    expect(result.mainLesson.importance.length).toBeGreaterThan(0);
    expect(result.mainLesson.corePoints.length).toBeGreaterThan(0);
    expect(result.mainLesson.technicalExample.toLowerCase()).toContain('<main>');
    expect(result.mainLesson.commonMisconceptions.length).toBeGreaterThan(0);
  });

  it('rejects a lesson for component organization when the output centers on HTML semantic instead', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition: 'Component là cách chia giao diện thành phần nhỏ.',
          importance: 'HTML semantic giúp trình duyệt hiểu cấu trúc trang tốt hơn.',
          corePoints: [
            'HTML semantic và cấu trúc trang.',
            'CSS layout và responsive design.',
          ],
          technicalExample: '<header><nav>...</nav></header>',
          commonMisconceptions: [],
          prerequisiteMiniLessons: [],
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          definition: 'Component là cách chia giao diện thành phần nhỏ có trách nhiệm rõ ràng.',
          importance: 'Nó giúp giao diện dễ tái sử dụng, bảo trì, và tách logic theo từng phần UI.',
          corePoints: [
            'Mỗi component nên có trách nhiệm rõ ràng.',
            'Component giúp tái sử dụng UI và cô lập thay đổi.',
          ],
          technicalExample: '<TaskCard title="Fix bug" status="doing" />',
          commonMisconceptions: [
            'Component không đồng nghĩa với việc mọi phần tử nhỏ đều phải tách file riêng.',
          ],
          prerequisiteMiniLessons: [],
        }),
      });

    const service = new TutorService({
      chatService: { chat } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'Tổ chức giao diện thành component',
      conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
      grounding: componentGrounding,
      sourceText: 'outline toàn session',
      siblingConceptNames: [
        'HTML semantic và cấu trúc trang',
        'CSS layout và responsive design',
        'JavaScript nền tảng',
      ],
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.mainLesson.importance).toContain('tái sử dụng');
  });

  it('falls back to grounding excerpt before full session source when grounded generation keeps failing', async () => {
    const chat = vi.fn().mockRejectedValue(new Error('upstream failure'));
    const service = new TutorService({
      chatService: { chat } as never,
    });

    const result = await service.generateLessonPackage({
      conceptName: 'Tổ chức giao diện thành component',
      conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
      grounding: componentGrounding,
      sourceText: 'outline toàn session có HTML semantic và CSS layout',
      siblingConceptNames: ['HTML semantic và cấu trúc trang'],
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(result.contentQuality).toBe('fallback');
    expect(result.grounding.quality).toBe('concept_specific');
    expect(result.mainLesson.definition).toContain('Chia giao diện');
    expect(result.mainLesson.corePoints.join(' ')).not.toContain('HTML semantic');
  });

  it('builds easy explanation from lesson summary first and source text second', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: 'Semantic HTML giúp người học hiểu vì sao mỗi vùng nội dung nên dùng đúng thẻ thay vì div chung chung.',
    });

    const service = new TutorService({
      chatService: { chat } as never,
    });

    await service.generateExplanation({
      conceptName: 'HTML semantic và cấu trúc trang',
      lessonSummary:
        'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc. Điều này giúp accessibility và maintainability tốt hơn.',
      sourceText:
        'header, nav, main, article, section, footer là các thẻ semantic phổ biến trong layout trang.',
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Nguồn chính: Semantic HTML dùng thẻ có ý nghĩa'),
        }),
        expect.objectContaining({
          content: expect.stringContaining('Nguồn phụ: header, nav, main, article'),
        }),
      ]),
      expect.any(Object)
    );
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
