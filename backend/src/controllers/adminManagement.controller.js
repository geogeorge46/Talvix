import * as service from '../services/adminManagement.service.js';

const handler = (serviceFn) => async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await serviceFn(req, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Users
export const getUsers = async (req, res, next) => {
  try {
    const data = await service.listUsers(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const data = await service.getUserDetail(req.params.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.updateUserStatus(req.params.userId, req.body.action, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const changeRole = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.changeUserRole(req.params.userId, req.body.role, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.resetUserPassword(req.params.userId, req.body.password, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.softDeleteUser(req.params.userId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const bulkUsers = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.bulkUserAction(req.body.userIds, req.body.action, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const exportUsers = async (req, res, next) => {
  try {
    const csv = await service.exportUsersCsv(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

// Recruiters
export const getRecruiters = async (req, res, next) => {
  try {
    const data = await service.listRecruiters(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getRecruiter = async (req, res, next) => {
  try {
    const data = await service.getRecruiterDetail(req.params.recruiterId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const removeRecruiter = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.removeRecruiterFromCompany(req.params.recruiterId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Companies
export const getCompanies = async (req, res, next) => {
  try {
    const data = await service.listCompanies(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getCompany = async (req, res, next) => {
  try {
    const data = await service.getCompanyDetail(req.params.companyId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const merge = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.mergeCompanies(req.body.primaryId, req.body.secondaryId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Jobs
export const getJobs = async (req, res, next) => {
  try {
    const data = await service.listJobs(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getJob = async (req, res, next) => {
  try {
    const data = await service.getJobDetail(req.params.jobId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const updateJob = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.updateJobStatus(req.params.jobId, req.body.status, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const clone = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.cloneJob(req.params.jobId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Questions
export const getQuestions = async (req, res, next) => {
  try {
    const data = await service.listQuestions(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const importQuestions = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.bulkImportQuestions(req.body.questions, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Documents
export const getDocuments = async (req, res, next) => {
  try {
    const data = await service.listDocuments(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const updateDocument = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.updateDocumentStatus(req.params.documentId, req.body.action, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Notifications
export const broadcast = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.broadcastNotification(req.body.title, req.body.body, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getEmailLogs = async (req, res, next) => {
  try {
    const data = await service.listEmailLogs(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const retryEmail = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.retryFailedEmailLog(req.params.logId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Audits
export const getAuditLogs = async (req, res, next) => {
  try {
    const data = await service.listAuditLogs(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Candidate application stage override
export const changeApplicationStage = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.changeApplicationStage(req.params.applicationId, req.body.status, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Assessments management
export const getAssessments = async (req, res, next) => {
  try {
    const data = await service.listAssessments(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const cloneAssessment = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.cloneAssessment(req.params.assessmentId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const forceSubmit = async (req, res, next) => {
  try {
    const ip = req.ip || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown';
    const data = await service.forceSubmitAttempt(req.params.attemptId, req.user.id, ip, ua);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

