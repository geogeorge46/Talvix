import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as controller from '../controllers/search.controller.js';

export const searchRouter = Router();

searchRouter.get('/', authenticate, controller.globalSearch);
