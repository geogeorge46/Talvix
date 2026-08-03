import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { listSavedViews, createSavedView, deleteSavedView } from '../controllers/savedViews.controller.js';

export const savedViewsRouter = Router();

savedViewsRouter.use(authenticate, requireCompanyAccess);

savedViewsRouter.get('/saved-views', listSavedViews);
savedViewsRouter.post('/saved-views', createSavedView);
savedViewsRouter.delete('/saved-views/:viewId', deleteSavedView);
