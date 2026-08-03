import { SavedAnalyticsView } from '../models/SavedAnalyticsView.js';

export const listSavedViews = async (request, response, next) => {
  try {
    const views = await SavedAnalyticsView.find({
      recruiter: request.user.id,
      company: request.company._id
    }).sort({ createdAt: -1 });

    return response.json({
      success: true,
      message: 'Saved analytics views retrieved successfully',
      data: { views }
    });
  } catch (error) {
    return next(error);
  }
};

export const createSavedView = async (request, response, next) => {
  try {
    const { name, filters, isDefault } = request.body;

    if (!name || !filters) {
      return response.status(400).json({
        success: false,
        message: 'Name and filters are required'
      });
    }

    // If isDefault is true, unset default on other views
    if (isDefault) {
      await SavedAnalyticsView.updateMany(
        { recruiter: request.user.id, company: request.company._id },
        { $set: { isDefault: false } }
      );
    }

    const view = await SavedAnalyticsView.create({
      recruiter: request.user.id,
      company: request.company._id,
      name,
      filters,
      isDefault: !!isDefault
    });

    return response.status(201).json({
      success: true,
      message: 'Analytics view saved successfully',
      data: { view }
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: 'A view with this name already exists'
      });
    }
    return next(error);
  }
};

export const deleteSavedView = async (request, response, next) => {
  try {
    const { viewId } = request.params;

    const result = await SavedAnalyticsView.deleteOne({
      _id: viewId,
      recruiter: request.user.id,
      company: request.company._id
    });

    if (result.deletedCount === 0) {
      return response.status(404).json({
        success: false,
        message: 'Saved view not found'
      });
    }

    return response.json({
      success: true,
      message: 'Saved analytics view deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
};
