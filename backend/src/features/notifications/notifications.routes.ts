import { Router } from 'express';
import * as notifications from './notifications.controller.js';

export const router = Router();

router.get('/notifications/stream/:userId', notifications.streamNotifications);
