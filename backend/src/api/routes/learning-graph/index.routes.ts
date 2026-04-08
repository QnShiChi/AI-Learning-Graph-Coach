import { Router, type Response, type NextFunction } from 'express';
import { verifyUser, type AuthRequest } from '@/api/middlewares/auth.js';
import { successResponse } from '@/utils/response.js';
import {
  createLearningSessionRequestSchema,
  submitConceptQuizRequestSchema,
} from '@insforge/shared-schemas';
import { LearningOrchestratorService } from '@/services/learning-graph/learning-orchestrator.service.js';
import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';

const router = Router();
const orchestrator = new LearningOrchestratorService();

router.post('/', verifyUser, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createLearningSessionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(JSON.stringify(parsed.error.issues), 400, ERROR_CODES.INVALID_INPUT);
    }

    const result = await orchestrator.createSession({
      userId: req.user!.id,
      topic: parsed.data.topic,
      sourceText: parsed.data.sourceText,
    });

    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:sessionId/concepts/:conceptId/quiz-submissions',
  verifyUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = submitConceptQuizRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(JSON.stringify(parsed.error.issues), 400, ERROR_CODES.INVALID_INPUT);
      }

      const result = await orchestrator.submitQuiz({
        sessionId: req.params.sessionId,
        conceptId: req.params.conceptId,
        quizId: parsed.data.quizId,
        answers: parsed.data.answers,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
