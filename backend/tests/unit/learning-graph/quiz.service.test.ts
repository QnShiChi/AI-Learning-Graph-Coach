import { describe, expect, it, vi } from 'vitest';
import { QuizService } from '@/services/learning-graph/quiz.service.js';
import type { GeneratedQuizQuestion } from '@/services/learning-graph/quiz-generation.prompts.js';
import type { LessonPackageSchema } from '@insforge/shared-schemas';

const lessonPackage: LessonPackageSchema = {
  version: 1,
  formatVersion: 2,
  regenerationReason: 'initial',
  mainLesson: {
    definition:
      'Backpropagation là quá trình lan truyền sai số từ output về các lớp trước để tính gradient.',
    importance:
      'Nó giúp mô hình biết cần điều chỉnh trọng số nào để giảm loss trong lần học tiếp theo.',
    corePoints: [
      'Sai số được đẩy ngược qua các lớp.',
      'Chain rule nối gradient của từng tầng thành gradient tổng thể.',
    ],
    technicalExample:
      'Mạng dùng chain rule để suy ra gradient của từng trọng số sau khi tính loss.',
    commonMisconceptions: ['Backpropagation không đồng nghĩa với gradient descent.'],
  },
  prerequisiteMiniLessons: [
    {
      prerequisiteConceptId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'On lai gradient descent',
      content: 'Gradient descent dung gradient de cap nhat tham so theo huong giam loss.',
    },
  ],
};

const makeGeneratedQuestion = (
  overrides: Partial<GeneratedQuizQuestion> = {}
): GeneratedQuizQuestion => ({
  question: 'Phát biểu nào mô tả đúng nhất về Backpropagation?',
  options: [
    'Lan truyền sai số ngược qua các lớp',
    'Lưu file vào storage',
    'Hiển thị giao diện người dùng',
    'Tạo OAuth để đăng nhập',
  ],
  correctAnswer: 'Lan truyền sai số ngược qua các lớp',
  explanationShort: 'Backpropagation đẩy tín hiệu lỗi ngược qua mạng để tính gradient.',
  difficulty: 'core',
  skillTag: 'definition',
  ...overrides,
});

const makeQuizInput = () => ({
  quizId: '11111111-1111-1111-1111-111111111111',
  sessionId: '22222222-2222-2222-2222-222222222222',
  conceptId: '33333333-3333-3333-3333-333333333333',
  conceptName: 'Backpropagation',
  conceptDescription: 'Backpropagation lan truyen loi tu output ve cac lop truoc.',
  explanationSummary:
    'Backpropagation tinh gradient bang cach lan truyen sai so nguoc qua cac lop.',
  technicalExample: 'Mạng dùng chain rule để suy ra gradient của từng trọng số.',
  missingPrerequisites: [],
  learnerMastery: 0.55,
  difficultyTarget: 'medium' as const,
  lessonPackage,
});

const nonItLessonPackage: LessonPackageSchema = {
  version: 1,
  formatVersion: 2,
  regenerationReason: 'initial',
  mainLesson: {
    definition:
      'Quang hợp là quá trình thực vật dùng ánh sáng để tổng hợp chất hữu cơ từ nước và khí carbon dioxide.',
    importance:
      'Nó giúp giải thích cách thực vật tạo năng lượng hóa học và vì sao ánh sáng ảnh hưởng trực tiếp đến sự phát triển của cây.',
    corePoints: [
      'Ánh sáng cung cấp năng lượng cho quá trình quang hợp.',
      'Nước và khí carbon dioxide là nguyên liệu đầu vào quan trọng.',
    ],
    technicalExample:
      'Ví dụ, đặt hai cây cùng loại vào nơi có ánh sáng và nơi thiếu ánh sáng thì cây được chiếu sáng phát triển tốt hơn.',
    commonMisconceptions: ['Quang hợp không diễn ra vào ban đêm khi không có ánh sáng.'],
  },
  prerequisiteMiniLessons: [],
};

const makeNonItQuizInput = () => ({
  quizId: 'aaaaaaaa-1111-1111-1111-111111111111',
  sessionId: 'bbbbbbbb-2222-2222-2222-222222222222',
  conceptId: 'cccccccc-3333-3333-3333-333333333333',
  conceptName: 'Quang hợp',
  conceptDescription:
    'Quang hợp là quá trình thực vật dùng ánh sáng để tổng hợp chất hữu cơ từ nước và khí carbon dioxide.',
  explanationSummary:
    'Quang hợp giúp thực vật tạo chất hữu cơ nhờ năng lượng ánh sáng, nước và khí carbon dioxide.',
  technicalExample:
    'Ví dụ, đặt hai cây cùng loại vào nơi có ánh sáng và nơi thiếu ánh sáng thì cây được chiếu sáng phát triển tốt hơn.',
  missingPrerequisites: [],
  learnerMastery: 0.2,
  difficultyTarget: 'core' as const,
  lessonPackage: nonItLessonPackage,
});

describe('QuizService', () => {
  it('uses llm quiz output when it passes validation', async () => {
    const service = new QuizService({
      chatService: {
        chat: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            questions: [
              makeGeneratedQuestion(),
              makeGeneratedQuestion({
                question: 'Ví dụ kỹ thuật trong bài cho thấy Backpropagation dùng để làm gì?',
                options: [
                  'Suy ra gradient của từng trọng số',
                  'Đổi màu giao diện của ứng dụng',
                  'Lưu file ảnh vào bucket',
                  'Tạo phiên đăng nhập mới',
                ],
                correctAnswer: 'Suy ra gradient của từng trọng số',
                difficulty: 'medium',
                skillTag: 'application',
              }),
              makeGeneratedQuestion({
                question: 'Điều nào là hiểu sai về Backpropagation?',
                options: [
                  'Backpropagation chỉ là tên khác của ví dụ minh họa',
                  'Backpropagation giúp tính gradient',
                  'Backpropagation đẩy lỗi ngược qua mạng',
                  'Backpropagation hỗ trợ cập nhật tham số',
                ],
                correctAnswer: 'Backpropagation chỉ là tên khác của ví dụ minh họa',
                difficulty: 'stretch',
                skillTag: 'misconception',
              }),
            ],
          }),
        }),
      },
    });

    const artifact = await service.buildQuizForConcept(makeQuizInput());
    const clientQuiz = service.toClientQuiz(artifact);

    expect(artifact.source).toBe('llm');
    expect(artifact.questionCountTarget).toBe(3);
    expect(artifact.questions).toHaveLength(3);
    expect(clientQuiz.questions[1]?.skillTag).toBe('application');
    expect(clientQuiz.questions[0]?.options[0]).not.toHaveProperty('isCorrect');
  });

  it('falls back to deterministic quiz when llm output keeps failing validation', async () => {
    const service = new QuizService({
      chatService: {
        chat: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            questions: [
              {
                question: 'Backpropagation là gì?',
                options: ['Cùng một ý', 'Cùng một ý', 'Cùng một ý', 'Cùng một ý'],
                correct_answer: 'Cùng một ý',
                explanation_short: 'Trả lời sai format',
                difficulty: 'core',
                skill_tag: 'definition',
              },
            ],
          }),
        }),
      },
    });

    const artifact = await service.buildQuizForConcept(makeQuizInput());

    expect(artifact.source).toBe('fallback');
    expect(artifact.questions.length).toBeGreaterThanOrEqual(2);
    expect(artifact.questions.length).toBeLessThanOrEqual(4);
    expect(
      artifact.questions.every(
        (question) => question.options.filter((option) => option.isCorrect).length === 1
      )
    ).toBe(true);
  });

  it('keeps fallback quiz distractors domain-neutral for non-it concepts', async () => {
    const service = new QuizService({
      chatService: {
        chat: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            questions: [
              {
                question: 'Quang hợp là gì?',
                options: ['Cùng một ý', 'Cùng một ý', 'Cùng một ý', 'Cùng một ý'],
                correct_answer: 'Cùng một ý',
                explanation_short: 'Trả lời sai format',
                difficulty: 'core',
                skill_tag: 'definition',
              },
            ],
          }),
        }),
      },
    });

    const artifact = await service.buildQuizForConcept(makeNonItQuizInput());
    const allOptions = artifact.questions.flatMap((question) =>
      question.options.map((option) => option.text)
    );

    expect(artifact.source).toBe('fallback');
    expect(allOptions.join(' ')).not.toMatch(/storage|oauth|giao diện/i);
  });

  it('grades answers against the persisted quiz artifact', () => {
    const service = new QuizService();

    const result = service.grade({
      quiz: {
        id: '44444444-4444-4444-4444-444444444444',
        sessionId: '22222222-2222-2222-2222-222222222222',
        conceptId: '33333333-3333-3333-3333-333333333333',
        lessonVersion: 1,
        status: 'active',
        source: 'llm',
        questionCountTarget: 2,
        createdAt: '2026-04-11T00:00:00.000Z',
        questions: [
          {
            id: 'q1',
            prompt: 'Backpropagation dung de lam gi?',
            difficulty: 'core',
            skillTag: 'definition',
            correctAnswer: 'Lan truyen sai so nguoc qua cac lop',
            explanationShort: 'Dap an dung.',
            options: [
              {
                id: 'a',
                text: 'Lan truyen sai so nguoc qua cac lop',
                isCorrect: true,
              },
              { id: 'b', text: 'Tai file len storage', isCorrect: false },
              { id: 'c', text: 'Hien thi giao dien', isCorrect: false },
              { id: 'd', text: 'Tao OAuth de dang nhap', isCorrect: false },
            ],
          },
          {
            id: 'q2',
            prompt: 'Gradient descent lien quan the nao?',
            difficulty: 'medium',
            skillTag: 'application',
            correctAnswer: 'Dung gradient de cap nhat tham so',
            explanationShort: 'Dap an dung.',
            options: [
              { id: 'e', text: 'Dung gradient de cap nhat tham so', isCorrect: true },
              { id: 'f', text: 'Dang nhap bang OAuth', isCorrect: false },
              { id: 'g', text: 'Luu file vao bucket', isCorrect: false },
              { id: 'h', text: 'Doi mau giao dien', isCorrect: false },
            ],
          },
        ],
      },
      answers: [
        { questionId: 'q1', selectedOptionId: 'a' },
        { questionId: 'q2', selectedOptionId: 'f' },
      ],
    });

    expect(result.score).toBe(0.5);
    expect(result.feedback).toContain('xem lại');
  });
});
