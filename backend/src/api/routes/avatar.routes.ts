import { Router } from 'express';
import { getAvatarByFileId } from '../controllers/avatar.controller';

const router = Router();

/**
 * Avatar Routes
 * 
 * @route GET /api/avatar/:fileId - Загрузить аватарку по file_id
 */

router.get('/:fileId', getAvatarByFileId);

export default router;
