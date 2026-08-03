import {
  fetchRecruiterDashboard,
  fetchCompanyDashboard,
  fetchRecruiterAnalytics,
  fetchRecruiterActivityTimeline
} from '../services/recruiterAnalytics.service.js';

export const getRecruiterDashboard = async (request, response, next) => {
  try {
    const data = await fetchRecruiterDashboard(request.user, request.company._id);
    return response.json({
      success: true,
      message: 'Recruiter dashboard metrics retrieved successfully',
      data
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyDashboard = async (request, response, next) => {
  try {
    const data = await fetchCompanyDashboard(request.company._id);
    return response.json({
      success: true,
      message: 'Company dashboard metrics retrieved successfully',
      data
    });
  } catch (error) {
    return next(error);
  }
};

export const getRecruiterAnalytics = async (request, response, next) => {
  try {
    const data = await fetchRecruiterAnalytics(request.company._id);
    return response.json({
      success: true,
      message: 'Recruiter analytics retrieved successfully',
      data
    });
  } catch (error) {
    return next(error);
  }
};

import { BackgroundJob } from '../models/BackgroundJob.js';

export const getRecruiterActivityTimeline = async (request, response, next) => {
  try {
    const isOwnerOrAdmin = request.companyMember.role === 'primary_admin' || request.recruiterProfile.isCompanyOwner;
    const data = await fetchRecruiterActivityTimeline(request.company._id, request.query, isOwnerOrAdmin);
    return response.json({
      success: true,
      message: 'Recruiter activity timeline retrieved successfully',
      data
    });
  } catch (error) {
    return next(error);
  }
};

export const triggerExport = async (request, response, next) => {
  try {
    const { reportType, format } = request.body;

    if (!reportType || !format) {
      return response.status(400).json({
        success: false,
        message: 'reportType and format are required'
      });
    }

    const job = await BackgroundJob.create({
      type: 'GENERATE_AUDIT_REPORT',
      priority: 'MEDIUM',
      priorityWeight: 2,
      payload: {
        companyId: request.company._id,
        userId: request.user._id,
        reportType,
        format
      }
    });

    return response.status(202).json({
      success: true,
      message: 'Report export task queued successfully. You will be notified on completion.',
      data: { jobId: job._id }
    });
  } catch (error) {
    return next(error);
  }
};
