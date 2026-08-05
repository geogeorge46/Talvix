import { Router } from 'express';

import { env } from '../config/env.js';
import { authRouter } from './auth.routes.js';
import { candidateRouter } from './candidate.routes.js';
import { companyRouter } from './company.routes.js';
import { jobRouter } from './job.routes.js';
import { jobTemplateRouter } from './jobTemplate.routes.js';
import { recruiterRouter } from './recruiter.routes.js';
import { applicationRouter } from './application.routes.js';
import { assessmentRouter } from './assessment.routes.js';
import { interviewRouter } from './interview.routes.js';
import { offerRouter } from './offer.routes.js';
import { notificationRouter } from './notification.routes.js';
import { documentRouter } from './document.routes.js';
import { adminAnalyticsRouter } from './adminAnalytics.routes.js';
import { companyInviteJoinClaimRouter } from './companyInviteJoinClaim.routes.js';
import { adminOverridesRouter } from './adminOverrides.routes.js';
import { adminManagementRouter } from './adminManagement.routes.js';
import { recruiterAnalyticsRouter } from './recruiterAnalytics.routes.js';
import { adminAIRouter } from './adminAI.routes.js';
import { resumeRouter } from './resumeIntelligence.routes.js';
import { jobIntelligenceRouter } from './jobIntelligence.routes.js';
import { matchingRouter } from './candidateMatching.routes.js';
import { copilotRouter } from './copilot.routes.js';
import { assessmentIntelRouter } from './assessmentIntelligence.routes.js';
import { candidateIntelRouter } from './candidateIntelligence.routes.js';
import { communicationRouter } from './communication.routes.js';
import { analyticsRouter } from './analytics.routes.js';
import { workflowRouter } from './workflow.routes.js';
import { agentRouter } from './agent.routes.js';
import { integrationRouter } from './integration.routes.js';
import { platformAdminRouter } from './admin.routes.js';
import { realtimeRouter } from './realtime.routes.js';
import { dashboardConfigRouter } from './dashboardConfig.routes.js';
import { savedViewsRouter } from './savedViews.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'Talvix API is running',
    environment: env.NODE_ENV,
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/candidates', candidateRouter);
apiRouter.use('/recruiters', recruiterRouter);
apiRouter.use('/companies', companyRouter);
apiRouter.use('/companies', companyInviteJoinClaimRouter);
apiRouter.use('/jobs/templates', jobTemplateRouter);
apiRouter.use('/jobs', jobRouter);
apiRouter.use('/applications', applicationRouter);
apiRouter.use('/assessments', assessmentRouter);
apiRouter.use('/interviews', interviewRouter);
apiRouter.use('/offers', offerRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/admin/analytics', adminAnalyticsRouter);
apiRouter.use('/admin/management', adminManagementRouter);
apiRouter.use('/admin/ai', adminAIRouter);
apiRouter.use('/resumes', resumeRouter);
apiRouter.use('/jobs/intelligence', jobIntelligenceRouter);
apiRouter.use('/matching', matchingRouter);
apiRouter.use('/copilot', copilotRouter);
apiRouter.use('/assessments/intelligence', assessmentIntelRouter);
apiRouter.use('/resume', candidateIntelRouter);
apiRouter.use('/collaboration', communicationRouter);
apiRouter.use('/intelligence/analytics', analyticsRouter);
apiRouter.use('/automation/workflows', workflowRouter);
apiRouter.use('/automation/agents', agentRouter);
apiRouter.use('/integrations', integrationRouter);
apiRouter.use('/admin', adminOverridesRouter);
apiRouter.use('/admin', platformAdminRouter);
apiRouter.use('/analytics', recruiterAnalyticsRouter);
apiRouter.use('/analytics', savedViewsRouter);
apiRouter.use('/realtime', realtimeRouter);
apiRouter.use('/dashboard', dashboardConfigRouter);

