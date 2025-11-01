import { Router } from 'express';
import { feedbackController } from '../controllers/feedback.controller';

const router = Router();

/**
 * @route POST /api/feedback
 * @desc Отправить обратную связь
 * @access Public (доступно всем пользователям)
 */
router.post('/', feedbackController.send.bind(feedbackController));

export default router;
