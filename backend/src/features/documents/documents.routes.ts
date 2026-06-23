import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import * as docs from './documents.controller.js';

export const router = Router();

router.post('/upload', authMiddleware, requireRole('CLIENT'), docs.upload.array('files', 5), docs.uploadDocument);
router.get('/', authMiddleware, requireRole('OWNER'), docs.listAll);
router.put('/:id/review', authMiddleware, requireRole('OWNER'), docs.reviewDocument);
router.get('/mine', authMiddleware, requireRole('CLIENT'), docs.listMine);
router.get('/:id/comments', authMiddleware, docs.getComments);
