import { describe, expect, it, vi } from 'vitest';
import { TutorService } from '@/services/learning-graph/tutor.service.js';

describe('TutorService', () => {
  it('grounds an OOP lesson package in the actual concept instead of generic error-tracing language', async () => {
    const service = new TutorService();

    const result = await service.generateLessonPackage({
      conceptName: 'Giới thiệu về OOP',
      conceptDescription:
        'OOP là cách tổ chức chương trình xoay quanh object và class. Ví dụ: Xe (object) được tạo ra từ bản thiết kế (class).',
      sourceText: `Các ý chính cần bám vào:
- Lập trình hướng đối tượng là cách tổ chức chương trình xoay quanh object và class
- Class là bản thiết kế, object là thực thể được tạo ra từ bản thiết kế đó
- Thuộc tính biểu diễn dữ liệu của object
- Phương thức biểu diễn hành vi của object`,
      masteryScore: 0,
      missingPrerequisites: [],
    });

    expect(result.feynmanExplanation).toContain('object');
    expect(result.feynmanExplanation).toContain('class');
    expect(result.feynmanExplanation).not.toContain('chỗ sai');
    expect(result.feynmanExplanation).not.toContain('lần ngược');
    expect(result.metaphorImage.imageUrl.startsWith('data:image/svg+xml')).toBe(true);
    expect(result.metaphorImage.prompt.toLowerCase()).toContain('oop');
    expect(result.imageReadingText.toLowerCase()).not.toContain('sửa lỗi');
    expect(result.technicalTranslation).toContain('object');
    expect(result.technicalTranslation).toContain('class');
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
