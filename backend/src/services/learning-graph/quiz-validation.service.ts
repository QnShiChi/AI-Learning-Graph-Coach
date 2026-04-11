import type { GeneratedQuizQuestion } from './quiz-generation.prompts.js';

const MAX_OPTION_LENGTH = 90;
const MAX_OPTION_WORDS = 20;
const MAX_QUESTION_LENGTH = 180;

export interface QuizQuestionValidationResult {
  ok: boolean;
  reasons: string[];
}

export interface QuizSetValidationResult {
  ok: boolean;
  reasons: string[];
  questionResults: QuizQuestionValidationResult[];
}

export class QuizValidationService {
  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(value: string) {
    return this.normalize(value)
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private similarity(left: string, right: string) {
    const leftTokens = new Set(this.tokenize(left));
    const rightTokens = new Set(this.tokenize(right));

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
  }

  validateQuestion(question: GeneratedQuizQuestion): QuizQuestionValidationResult {
    const reasons: string[] = [];

    if (question.question.trim().length > MAX_QUESTION_LENGTH) {
      reasons.push('question_too_long');
    }

    const normalizedOptions = question.options.map((option) => this.normalize(option));
    if (new Set(normalizedOptions).size !== question.options.length) {
      reasons.push('options_too_similar');
    }

    if (
      question.options.some(
        (option) =>
          option.trim().length > MAX_OPTION_LENGTH || this.tokenize(option).length > MAX_OPTION_WORDS
      )
    ) {
      reasons.push('option_too_long');
    }

    if (this.normalize(question.question).includes('cach giai thich')) {
      reasons.push('meta_question');
    }

    for (let index = 0; index < question.options.length; index += 1) {
      for (let candidateIndex = index + 1; candidateIndex < question.options.length; candidateIndex += 1) {
        if (this.similarity(question.options[index]!, question.options[candidateIndex]!) >= 0.6) {
          reasons.push('options_too_similar');
          index = question.options.length;
          break;
        }
      }
    }

    const exactMatches = question.options.filter(
      (option) => this.normalize(option) === this.normalize(question.correctAnswer)
    );

    if (exactMatches.length !== 1) {
      reasons.push('single_correctness_failed');
    }

    return {
      ok: reasons.length === 0,
      reasons: [...new Set(reasons)],
    };
  }

  validateQuizSet(questions: GeneratedQuizQuestion[]): QuizSetValidationResult {
    const questionResults = questions.map((question) => this.validateQuestion(question));
    const reasons = new Set<string>();

    questionResults.forEach((result) => result.reasons.forEach((reason) => reasons.add(reason)));

    if (questions.length < 2 || questions.length > 4) {
      reasons.add('invalid_question_count');
    }

    const skillTagCount = new Set(questions.map((question) => question.skillTag)).size;
    if (questions.length >= 3 && skillTagCount < 2) {
      reasons.add('coverage_too_narrow');
    }

    const normalizedQuestions = questions.map((question) => this.normalize(question.question));
    if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
      reasons.add('question_repetition');
    }

    return {
      ok: reasons.size === 0 && questionResults.every((result) => result.ok),
      reasons: [...reasons],
      questionResults,
    };
  }

  toFeedback(result: QuizSetValidationResult) {
    const messages: string[] = [];

    if (result.reasons.includes('invalid_question_count')) {
      messages.push('Số câu hỏi phải nằm trong khoảng 2 đến 4.');
    }
    if (result.reasons.includes('coverage_too_narrow')) {
      messages.push('Bộ câu hỏi đang hỏi trùng một góc nhìn, hãy tăng độ bao phủ ít nhất 2 loại câu hỏi.');
    }
    if (result.reasons.includes('question_repetition')) {
      messages.push('Không lặp lại cùng một ý hỏi ở nhiều câu.');
    }

    result.questionResults.forEach((questionResult, index) => {
      if (questionResult.reasons.includes('question_too_long')) {
        messages.push(`Câu ${index + 1} đang quá dài, cần ngắn và dễ scan hơn.`);
      }
      if (questionResult.reasons.includes('option_too_long')) {
        messages.push(`Câu ${index + 1} có đáp án quá dài, hãy rút gọn từng lựa chọn.`);
      }
      if (questionResult.reasons.includes('options_too_similar')) {
        messages.push(`Câu ${index + 1} có các lựa chọn quá giống nhau.`);
      }
      if (questionResult.reasons.includes('single_correctness_failed')) {
        messages.push(`Câu ${index + 1} chưa có đúng 1 đáp án đúng rõ ràng.`);
      }
      if (questionResult.reasons.includes('meta_question')) {
        messages.push(`Câu ${index + 1} đang hỏi meta về cách giải thích, hãy đổi sang kiểm tra kiến thức.`);
      }
    });

    return [...new Set(messages)];
  }
}
