import { describe, expect, it } from 'vitest';
import { QuizValidationService } from '@/services/learning-graph/quiz-validation.service.js';
import type { GeneratedQuizQuestion } from '@/services/learning-graph/quiz-generation.prompts.js';

const makeQuestion = (overrides: Partial<GeneratedQuizQuestion> = {}): GeneratedQuizQuestion => ({
  question: 'Encapsulation dùng để làm gì trong lập trình hướng đối tượng?',
  options: [
    'Ẩn dữ liệu và kiểm soát truy cập',
    'Sao chép mọi lớp thành nhiều bản',
    'Hiển thị giao diện đẹp hơn',
    'Lưu toàn bộ code vào một file',
  ],
  correctAnswer: 'Ẩn dữ liệu và kiểm soát truy cập',
  explanationShort: 'Encapsulation bảo vệ dữ liệu và giới hạn truy cập trực tiếp.',
  difficulty: 'core',
  skillTag: 'definition',
  ...overrides,
});

describe('QuizValidationService', () => {
  it('rejects options that are too long for UI scanning', () => {
    const validator = new QuizValidationService();

    const result = validator.validateQuestion(
      makeQuestion({
        options: [
          'Đây là một lựa chọn quá dài, vượt quá giới hạn scan nhanh trên giao diện và buộc người học phải đọc như một đoạn văn',
          'Tách trách nhiệm thành nhiều lớp',
          'Ẩn dữ liệu và kiểm soát truy cập',
          'Tái sử dụng class qua kế thừa',
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('option_too_long');
  });

  it('rejects a question when options collapse into near-duplicates', () => {
    const validator = new QuizValidationService();

    const result = validator.validateQuestion(
      makeQuestion({
        options: [
          'Che giấu dữ liệu bên trong object',
          'Ẩn dữ liệu bên trong object',
          'Tạo nhiều object mới',
          'Lưu code vào database',
        ],
        correctAnswer: 'Che giấu dữ liệu bên trong object',
      })
    );

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('options_too_similar');
  });

  it('rejects a quiz set that repeats the same angle three times', () => {
    const validator = new QuizValidationService();

    const result = validator.validateQuizSet([
      makeQuestion({
        question: 'Encapsulation là gì?',
        skillTag: 'definition',
      }),
      makeQuestion({
        question: 'Định nghĩa đúng của encapsulation là gì?',
        skillTag: 'definition',
      }),
      makeQuestion({
        question: 'Phát biểu nào mô tả đúng nhất về encapsulation?',
        skillTag: 'definition',
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('coverage_too_narrow');
  });
});
