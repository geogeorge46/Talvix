import { RecruiterDashboardConfig } from '../models/RecruiterDashboardConfig.js';

const DEFAULT_WIDGETS = [
  { id: 'metrics', visible: true, order: 0 },
  { id: 'pipeline', visible: true, order: 1 },
  { id: 'workspace', visible: true, order: 2 },
  { id: 'recentActivity', visible: true, order: 3 },
  { id: 'quickActions', visible: true, order: 4 },
  { id: 'insights', visible: true, order: 5 }
];

export const getWidgetsConfig = async (request, response, next) => {
  try {
    const config = await RecruiterDashboardConfig.findOne({
      recruiter: request.user.id,
      company: request.company._id
    });

    let widgets = config ? config.widgets : DEFAULT_WIDGETS;

    // Self-healing: if retrieved widgets contain old/legacy IDs, default back to correct widgets
    const hasCorrectWidgets = widgets.some(w => ['metrics', 'pipeline', 'workspace', 'quickActions', 'insights'].includes(w.id));
    if (!hasCorrectWidgets) {
      widgets = DEFAULT_WIDGETS;
    }

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
