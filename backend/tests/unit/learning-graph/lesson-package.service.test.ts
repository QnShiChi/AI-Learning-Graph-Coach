import { afterEach, describe, expect, it, vi } from 'vitest';
import { LessonPackageService } from '@/services/learning-graph/lesson-package.service.js';
import { SessionService } from '@/services/learning-graph/session.service.js';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

describe('LessonPackageService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the persisted current lesson package without regenerating it', async () => {
    const persistedLessonPackage = {
      version: 1,
      regenerationReason: 'initial' as const,
      feynmanExplanation: 'Backpropagation truyền lỗi ngược từ đầu ra về các tầng trước đó.',
      metaphorImage: {
        imageUrl: 'https://example.com/backpropagation.png',
        prompt: 'A river flowing backward through connected water gates',
      },
      imageMapping: [
        {
          visualElement: 'Dòng nước chảy ngược',
          everydayMeaning: 'Thông tin phản hồi quay lại điểm xuất phát',
          technicalMeaning: 'Gradient được lan truyền ngược qua mạng',
          teachingPurpose: 'Giúp người học hình dung chiều cập nhật trọng số',
        },
      ],
      imageReadingText: 'Hãy nhìn dòng nước ngược để tưởng tượng cách lỗi quay lại từng lớp.',
      technicalTranslation: 'Về mặt kỹ thuật, gradient của loss được tính bằng chain rule.',
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

    const generatedLessonPackage = {
      version: 1,
      regenerationReason: 'initial' as const,
      feynmanExplanation: 'Backpropagation giống như xem lại từng bước sai ở cuối bài để sửa từ đầu.',
      metaphorImage: {
        imageUrl: 'https://example.com/backpropagation-initial.png',
        prompt: 'A teacher tracing a mistake backward across connected notes',
      },
      imageMapping: [
        {
          visualElement: 'Giáo viên lần ngược các ghi chú',
          everydayMeaning: 'Xem lỗi xuất hiện từ đâu',
          technicalMeaning: 'Lan truyền gradient qua từng tầng',
          teachingPurpose: 'Nối trực giác sửa lỗi với cơ chế cập nhật trọng số',
        },
      ],
      imageReadingText: 'Hình ảnh nhấn mạnh rằng ta bắt đầu ở kết quả sai rồi lần ngược về nguyên nhân.',
      technicalTranslation:
        'Trong mạng nơ-ron, chain rule cho phép tính gradient của từng tham số từ loss.',
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
      sourceText: 'Backpropagation lan truyền lỗi từ output về hidden layers.',
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
      regenerationReason: 'initial' as const,
      feynmanExplanation: 'Gradient Descent giống như đi xuống dốc để tìm điểm thấp nhất.',
      metaphorImage: {
        imageUrl: 'https://example.com/gradient-descent.png',
        prompt: 'A person walking downhill toward the lowest point in a valley',
      },
      imageMapping: [
        {
          visualElement: 'Người đi xuống dốc',
          everydayMeaning: 'Đi từng bước để xuống thấp hơn',
          technicalMeaning: 'Cập nhật tham số theo hướng giảm loss',
          teachingPurpose: 'Giúp người học hình dung quá trình tối ưu lặp lại',
        },
      ],
      imageReadingText: 'Mỗi bước xuống dốc tượng trưng cho một lần cập nhật tham số.',
      technicalTranslation: 'Gradient descent cập nhật tham số theo negative gradient của loss.',
      prerequisiteMiniLessons: [],
    };

    vi.spyOn(SessionService.prototype, 'getCurrentLessonPackage')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(generatedLessonPackage);
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
});
