import { RecruiterDashboardConfig } from '../models/RecruiterDashboardConfig.js';

const DEFAULT_WIDGETS = [
  { id: 'activeJobs', visible: true, order: 0 },
  { id: 'draftJobs', visible: true, order: 1 },
  { id: 'applications', visible: true, order: 2 },
  { id: 'interviews', visible: true, order: 3 },
  { id: 'offers', visible: true, order: 4 },
  { id: 'analytics', visible: true, order: 5 },
  { id: 'notifications', visible: true, order: 6 },
  { id: 'teamMembers', visible: true, order: 7 },
  { id: 'calendar', visible: true, order: 8 },
  { id: 'recentActivity', visible: true, order: 9 }
];

export const getWidgetsConfig = async (request, response, next) => {
  try {
    const config = await RecruiterDashboardConfig.findOne({
      recruiter: request.user.id,
      company: request.company._id
    });

    const widgets = config ? config.widgets : DEFAULT_WIDGETS;

    return response.json({
      success: true,
      message: 'Dashboard widget configuration retrieved successfully',
      data: { widgets }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWidgetsConfig = async (request, response, next) => {
  try {
    const { widgets, reset } = request.body;

    if (reset) {
      await RecruiterDashboardConfig.deleteOne({
        recruiter: request.user.id,
        company: request.company._id
      });
      return response.json({
        success: true,
        message: 'Dashboard layout restored to default successfully',
        data: { widgets: DEFAULT_WIDGETS }
      });
    }

    let config = await RecruiterDashboardConfig.findOne({
      recruiter: request.user.id,
      company: request.company._id
    });

    if (!config) {
      config = new RecruiterDashboardConfig({
        recruiter: request.user.id,
        company: request.company._id,
        widgets: []
      });
    }

    config.widgets = widgets;
    await config.save();

    return response.json({
      success: true,
      message: 'Dashboard widget configuration updated successfully',
      data: { widgets: config.widgets }
    });
  } catch (error) {
    return next(error);
  }
};
