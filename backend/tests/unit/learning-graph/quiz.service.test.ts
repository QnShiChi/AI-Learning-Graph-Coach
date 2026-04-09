import { describe, expect, it } from 'vitest';
import { QuizService } from '@/services/learning-graph/quiz.service.js';
import type { LessonPackageSchema } from '@insforge/shared-schemas';

const lessonPackage: LessonPackageSchema = {
  version: 1,
  regenerationReason: 'initial',
  feynmanExplanation:
    'Backpropagation la quy trinh lan truyen sai so tu output ve cac lop truoc de dieu chinh tham so.',
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

describe('QuizService', () => {
  it('builds a persisted quiz artifact and hides answer keys from the client payload', () => {
    const service = new QuizService();

    const artifact = service.buildQuizFromLesson({
      quizId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      conceptName: 'Backpropagation',
      lessonPackage,
    });

    expect(artifact.questions.length).toBeGreaterThan(0);
    expect(artifact.lessonVersion).toBe(1);
    expect(artifact.questions.every((question) => question.options.length >= 2)).toBe(true);
    expect(
      artifact.questions.every(
        (question) => question.options.filter((option) => option.isCorrect).length === 1
      )
    ).toBe(true);

    const clientQuiz = service.toClientQuiz(artifact);

    expect(clientQuiz).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      status: 'active',
    });
    expect(clientQuiz.questions[0]?.options[0]).not.toHaveProperty('isCorrect');
  });

  it('grades answers against the persisted quiz artifact instead of a placeholder question', () => {
    const service = new QuizService();

    const result = service.grade({
      quiz: {
        id: '44444444-4444-4444-4444-444444444444',
        sessionId: '22222222-2222-2222-2222-222222222222',
        conceptId: '33333333-3333-3333-3333-333333333333',
        status: 'active',
        createdAt: '2026-04-09T00:00:00.000Z',
        questions: [
          {
            id: 'q1',
            prompt: 'Backpropagation dung de lam gi?',
            options: [
              { id: 'a', text: 'Lan truyen sai so nguoc qua cac lop', isCorrect: true },
              { id: 'b', text: 'Tai file len storage', isCorrect: false },
            ],
          },
          {
            id: 'q2',
            prompt: 'Gradient descent lien quan the nao?',
            options: [
              { id: 'a', text: 'Dung gradient de cap nhat tham so', isCorrect: true },
              { id: 'b', text: 'Dung OAuth de dang nhap', isCorrect: false },
            ],
          },
        ],
      },
      answers: [
        { questionId: 'q1', selectedOptionId: 'a' },
        { questionId: 'q2', selectedOptionId: 'b' },
      ],
    });

    expect(result.score).toBe(0.5);
    expect(result.feedback).toContain('tiếng Việt');
  });

  it('adds fallback distractors when lesson texts collapse to duplicates', () => {
    const service = new QuizService();

    const artifact = service.buildQuizFromLesson({
      quizId: 'aaaaaaaa-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      conceptId: '33333333-3333-3333-3333-333333333333',
      conceptName: 'Backpropagation',
      lessonPackage: {
        ...lessonPackage,
        feynmanExplanation: 'Cung mot noi dung',
        technicalTranslation: 'Cung mot noi dung',
        imageReadingText: 'Cung mot noi dung',
        metaphorImage: {
          ...lessonPackage.metaphorImage,
          prompt: 'Cung mot noi dung',
        },
        prerequisiteMiniLessons: [],
        imageMapping: [
          {
            visualElement: 'Mui ten',
            everydayMeaning: 'Cung mot noi dung',
            technicalMeaning: 'Cung mot noi dung',
            teachingPurpose: 'Cung mot noi dung',
          },
        ],
      },
    });

    expect(artifact.questions.every((question) => question.options.length >= 2)).toBe(true);
  });
});
