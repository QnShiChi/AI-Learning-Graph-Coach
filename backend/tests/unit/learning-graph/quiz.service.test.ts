import { describe, expect, it, vi } from 'vitest';
import { QuizService } from '@/services/learning-graph/quiz.service.js';
import type { GeneratedQuizQuestion } from '@/services/learning-graph/quiz-generation.prompts.js';
import type { LessonPackageSchema } from '@insforge/shared-schemas';

const lessonPackage: LessonPackageSchema = {
  version: 1,
  regenerationReason: 'initial',
  feynmanExplanation:
    'Backpropagation có thể hình dung như lần theo dấu lỗi để biết cần sửa lớp nào trước.',
  metaphorImage: {
    imageUrl: 'https://example.com/learning-graph/backpropagation.png',
    prompt: 'Mo ta backpropagation nhu viec lan theo dau vet loi.',
  },
  imageMapping: [
    {
      visualElement: 'Mui ten quay nguoc',
      everydayMeaning: 'Lan nguoc de tim noi gay loi',
      technicalMeaning: 'Sai so duoc day nguoc qua mang',
      teachingPurpose: 'Giu cho nguoi hoc nho huong truyen cua tin hieu loi',
    },
  ],
  imageReadingText: 'Hinh anh nhac rang can lan nguoc qua tung lop de sua sai.',
  technicalTranslation:
    'Ve ky thuat, backpropagation tinh gradient bang cach lan truyen sai so nguoc qua cac lop.',
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
  exampleOrAnalogy: 'Hinh dung nhu lan theo dau vet loi de tim noi can sua.',
  missingPrerequisites: [],
  learnerMastery: 0.55,
  difficultyTarget: 'medium' as const,
  lessonPackage,
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
                question: 'Trong ví dụ minh họa, mui ten quay nguoc dùng để gợi đến điều gì?',
                options: [
                  'Sai số được đẩy ngược qua mạng',
                  'Màu nền của giao diện tối',
                  'Tên file ảnh minh họa',
                  'Tài khoản người dùng mới',
                ],
                correctAnswer: 'Sai số được đẩy ngược qua mạng',
                difficulty: 'medium',
                skillTag: 'analogy',
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
    expect(clientQuiz.questions[1]?.skillTag).toBe('analogy');
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
