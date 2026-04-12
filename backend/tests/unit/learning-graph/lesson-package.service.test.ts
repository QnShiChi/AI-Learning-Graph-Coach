import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConceptGroundingService } from '@/services/learning-graph/concept-grounding.service.js';
import { LessonPackageService } from '@/services/learning-graph/lesson-package.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

describe('LessonPackageService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts concept-specific grounding for component organization instead of using the full session outline', () => {
    const groundingService = new ConceptGroundingService();

    const grounding = groundingService.extract({
      conceptName: 'Tổ chức giao diện thành component',
      conceptDescription: 'Chia giao diện thành các phần nhỏ có trách nhiệm rõ ràng.',
      siblingConceptNames: [
        'HTML semantic và cấu trúc trang',
        'CSS layout và responsive design',
        'JavaScript nền tảng',
      ],
      sourceText: `1. HTML semantic và cấu trúc trang
HTML semantic là cách dùng các thẻ có ý nghĩa như header, nav, main, section, article, aside, footer.

4. Tổ chức giao diện thành component
Giao diện nên được chia thành các phần nhỏ có trách nhiệm rõ ràng.
Mỗi component nên đại diện cho một phần UI độc lập như button, form, card, modal, navbar hoặc task item.

5. React cơ bản
Cần hiểu JSX, component, props, state.`,
    });

    expect(grounding.quality).toBe('concept_specific');
    expect(grounding.sourceExcerpt).toContain('Giao diện nên được chia thành các phần nhỏ');
    expect(grounding.sourceExcerpt).not.toContain('HTML semantic là cách dùng các thẻ');
    expect(grounding.sourceHighlights.length).toBeGreaterThan(0);
  });

  it('returns the persisted current lesson package without regenerating it', async () => {
    const persistedLessonPackage = {
      version: 1,
      formatVersion: 2 as const,
      contentQuality: 'validated' as const,
      regenerationReason: 'initial' as const,
      grounding: {
        sourceExcerpt: 'Backpropagation là quá trình lan truyền sai số từ output về các tầng trước đó.',
        sourceHighlights: [
          'Backpropagation là quá trình lan truyền sai số từ output về các tầng trước đó.',
        ],
        quality: 'concept_specific' as const,
      },
      mainLesson: {
        definition: 'Backpropagation là quá trình lan truyền sai số từ output về các tầng trước đó.',
        importance: 'Nó cho phép mạng nơ-ron tính gradient để cập nhật trọng số.',
        corePoints: [
          'Sai số được lan truyền ngược qua từng tầng.',
          'Chain rule được dùng để tính gradient của từng tham số.',
        ],
        technicalExample:
          'Sau khi tính loss ở output, mạng dùng chain rule để suy ra gradient của từng trọng số.',
        commonMisconceptions: [
          'Backpropagation không phải là bước cập nhật tham số; nó là bước tính gradient.',
        ],
      },
      prerequisiteMiniLessons: [],
    };

    const getCurrentLessonPackage = vi
      .spyOn(SessionService.prototype, 'getCurrentLessonPackage')
      .mockResolvedValue(persistedLessonPackage);
    const insertLessonPackage = vi
      .spyOn(SessionService.prototype, 'insertLessonPackage')
      .mockResolvedValue(true);
    const generateLessonPackage = vi
      .spyOn(TutorService.prototype, 'generateLessonPackage')
      .mockResolvedValue(persistedLessonPackage);

    const service = new LessonPackageService();
    const result = await service.getOrCreateCurrentLessonPackage({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      conceptName: 'Backpropagation',
      conceptDescription: 'desc',
      sourceText: 'Backpropagation lan truyền lỗi từ output về hidden layers.',
      masteryScore: 0.2,
      prerequisites: [],
    });

    expect(result).toEqual(persistedLessonPackage);
    expect(getCurrentLessonPackage).toHaveBeenCalledWith(
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    );
    expect(generateLessonPackage).not.toHaveBeenCalled();
    expect(insertLessonPackage).not.toHaveBeenCalled();
  });

  it('generates and persists an initial lesson package when the concept has no current one', async () => {
    vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage').mockResolvedValue(null);
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          sessionId: '55555555-5555-5555-5555-555555555555',
          canonicalName: 'html-semantic',
          displayName: 'HTML semantic và cấu trúc trang',
          description: 'Semantic HTML mô tả vai trò nội dung.',
          difficulty: 0.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '66666666-6666-6666-6666-666666666666',
          sessionId: '55555555-5555-5555-5555-555555555555',
          canonicalName: 'backpropagation',
          displayName: 'Backpropagation',
          description: 'desc',
          difficulty: 0.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      edges: [],
    });

    const generatedLessonPackage = {
      version: 1,
      formatVersion: 2 as const,
      contentQuality: 'validated' as const,
      regenerationReason: 'initial' as const,
      grounding: {
        sourceExcerpt:
          'Backpropagation là quá trình lan truyền sai số ngược qua các tầng để tính gradient.',
        sourceHighlights: [
          'Backpropagation là quá trình lan truyền sai số ngược qua các tầng để tính gradient.',
        ],
        quality: 'concept_specific' as const,
      },
      mainLesson: {
        definition:
          'Backpropagation là quá trình lan truyền sai số ngược qua các tầng để tính gradient.',
        importance:
          'Nó giúp mô hình biết cần điều chỉnh trọng số nào để giảm loss trong lần học tiếp theo.',
        corePoints: [
          'Sai số bắt đầu từ output rồi đi ngược về hidden layers.',
          'Chain rule nối gradient của từng tầng thành gradient tổng thể.',
        ],
        technicalExample:
          'Từ loss ở output, mạng tính đạo hàm theo từng trọng số ở các tầng trước bằng chain rule.',
        commonMisconceptions: [
          'Backpropagation không đồng nghĩa với gradient descent.',
        ],
      },
      prerequisiteMiniLessons: [
        {
          prerequisiteConceptId: '77777777-7777-7777-7777-777777777777',
          title: 'Ôn lại Chain Rule',
          content: 'Chain rule cho biết đạo hàm của hàm hợp được tính bằng tích các đạo hàm thành phần.',
        },
      ],
    };

    const generateLessonPackage = vi
      .spyOn(TutorService.prototype, 'generateLessonPackage')
      .mockResolvedValue(generatedLessonPackage);
    const insertLessonPackage = vi
      .spyOn(SessionService.prototype, 'insertLessonPackage')
      .mockResolvedValue(true);

    const service = new LessonPackageService();
    const result = await service.getOrCreateCurrentLessonPackage({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      conceptName: 'Backpropagation',
      conceptDescription: 'desc',
      sourceText: 'Backpropagation lan truyền lỗi từ output về hidden layers.',
      masteryScore: 0.2,
      prerequisites: [
        {
          id: '77777777-7777-7777-7777-777777777777',
          displayName: 'Chain Rule',
          description: 'Nền tảng để tính gradient qua nhiều hàm hợp.',
        },
      ],
    });

    expect(generateLessonPackage).toHaveBeenCalledWith({
      conceptName: 'Backpropagation',
      conceptDescription: 'desc',
      grounding: expect.objectContaining({
        quality: 'concept_specific',
      }),
      sourceText: 'Backpropagation lan truyền lỗi từ output về hidden layers.',
      siblingConceptNames: ['HTML semantic và cấu trúc trang'],
      masteryScore: 0.2,
      missingPrerequisites: [
        {
          id: '77777777-7777-7777-7777-777777777777',
          displayName: 'Chain Rule',
          description: 'Nền tảng để tính gradient qua nhiều hàm hợp.',
        },
      ],
      regenerationReason: 'initial',
    });
    expect(insertLessonPackage).toHaveBeenCalledWith({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      lessonPackage: generatedLessonPackage,
    });
    expect(result).toEqual(generatedLessonPackage);
  });

  it('re-reads the persisted lesson package when a concurrent insert wins first', async () => {
    const generatedLessonPackage = {
      version: 1,
      formatVersion: 2 as const,
      contentQuality: 'validated' as const,
      regenerationReason: 'initial' as const,
      grounding: {
        sourceExcerpt:
          'Gradient descent cập nhật tham số theo hướng làm loss giảm dần qua nhiều lần lặp.',
        sourceHighlights: [
          'Gradient descent cập nhật tham số theo hướng làm loss giảm dần qua nhiều lần lặp.',
        ],
        quality: 'concept_specific' as const,
      },
      mainLesson: {
        definition:
          'Gradient descent cập nhật tham số theo hướng làm loss giảm dần qua nhiều lần lặp.',
        importance: 'Đây là cơ chế tối ưu cốt lõi giúp mô hình học từ dữ liệu.',
        corePoints: [
          'Gradient cho biết hướng loss tăng mạnh nhất.',
          'Ta đi ngược gradient để giảm loss.',
        ],
        technicalExample:
          'w = w - learningRate * gradient là công thức cập nhật trọng số cơ bản.',
        commonMisconceptions: ['Gradient descent không tự tính gradient; nó dùng gradient đã có.'],
      },
      prerequisiteMiniLessons: [],
    };

    vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(generatedLessonPackage);
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          sessionId: '55555555-5555-5555-5555-555555555555',
          canonicalName: 'gradient-descent',
          displayName: 'Gradient Descent',
          description: 'desc',
          difficulty: 0.4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      edges: [],
    });
    vi.spyOn(TutorService.prototype, 'generateLessonPackage').mockResolvedValue(generatedLessonPackage);
    vi.spyOn(SessionService.prototype, 'insertLessonPackage').mockResolvedValue(false);

    const service = new LessonPackageService();
    const result = await service.getOrCreateCurrentLessonPackage({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      conceptName: 'Gradient Descent',
      conceptDescription: 'desc',
      sourceText: 'Gradient descent updates parameters iteratively.',
      masteryScore: 0.4,
      prerequisites: [],
    });

    expect(result).toEqual(generatedLessonPackage);
  });

  it('regenerates legacy payloads into formatVersion 2 lesson packages', async () => {
    const legacyLessonPackage = {
      version: 1,
      regenerationReason: 'initial' as const,
      feynmanExplanation: 'HTML semantic giống như garage với bản thiết kế xe.',
      metaphorImage: {
        imageUrl: 'https://example.com/legacy.png',
        prompt: 'legacy prompt',
      },
      imageMapping: [],
      imageReadingText: 'legacy',
      technicalTranslation: 'legacy technical translation',
      prerequisiteMiniLessons: [],
    };

    const regeneratedLessonPackage = {
      version: 2,
      formatVersion: 2 as const,
      contentQuality: 'validated' as const,
      regenerationReason: 'academic_redesign' as const,
      grounding: {
        sourceExcerpt: 'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
        sourceHighlights: ['Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.'],
        quality: 'concept_specific' as const,
      },
      mainLesson: {
        definition: 'Semantic HTML dùng thẻ có ý nghĩa để mô tả cấu trúc nội dung.',
        importance: 'Cấu trúc đúng giúp accessibility và maintainability tốt hơn.',
        corePoints: ['header, main, section, article, nav, footer có vai trò khác nhau.'],
        technicalExample: '<main><article><h1>Bài viết</h1></article></main>',
        commonMisconceptions: ['Semantic HTML không chỉ là đổi tên div.'],
      },
      prerequisiteMiniLessons: [],
    };

    vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage')
      .mockResolvedValueOnce(legacyLessonPackage)
      .mockResolvedValueOnce(regeneratedLessonPackage);
    vi.spyOn(SessionService.prototype, 'getGraph').mockResolvedValue({
      concepts: [
        {
          id: '77777777-7777-7777-7777-777777777777',
          sessionId: '55555555-5555-5555-5555-555555555555',
          canonicalName: 'css-layout',
          displayName: 'CSS layout và responsive design',
          description: 'desc',
          difficulty: 0.3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '66666666-6666-6666-6666-666666666666',
          sessionId: '55555555-5555-5555-5555-555555555555',
          canonicalName: 'html-semantic',
          displayName: 'HTML semantic và cấu trúc trang',
          description: 'Semantic HTML mô tả cấu trúc nội dung.',
          difficulty: 0.2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      edges: [],
    });
    const generateLessonPackage = vi
      .spyOn(TutorService.prototype, 'generateLessonPackage')
      .mockResolvedValue(regeneratedLessonPackage);
    const insertLessonPackage = vi
      .spyOn(SessionService.prototype, 'insertLessonPackage')
      .mockResolvedValue(true);

    const service = new LessonPackageService();
    const result = await service.getOrCreateCurrentLessonPackage({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription: 'Semantic HTML mô tả cấu trúc nội dung.',
      sourceText: 'Semantic HTML mô tả vai trò của từng vùng nội dung.',
      masteryScore: 0,
      prerequisites: [],
    });

    expect(result.formatVersion).toBe(2);
    expect(generateLessonPackage).toHaveBeenCalledWith({
      conceptName: 'HTML semantic và cấu trúc trang',
      conceptDescription: 'Semantic HTML mô tả cấu trúc nội dung.',
      grounding: expect.objectContaining({
        quality: 'session_level',
      }),
      sourceText: 'Semantic HTML mô tả vai trò của từng vùng nội dung.',
      siblingConceptNames: ['CSS layout và responsive design'],
      masteryScore: 0,
      missingPrerequisites: [],
      regenerationReason: 'academic_redesign',
      version: 2,
    });
    expect(insertLessonPackage).toHaveBeenCalledWith({
      sessionId: '55555555-5555-5555-5555-555555555555',
      conceptId: '66666666-6666-6666-6666-666666666666',
      lessonPackage: regeneratedLessonPackage,
    });
    expect(result).toEqual(regeneratedLessonPackage);
  });
});
