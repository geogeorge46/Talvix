import { Application } from '../models/Application.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { buildPagination } from '../utils/pagination.js';

const find = async (id) => { const application = await Application.findById(id); if (!application) throw new AppError('Application not found', 404); return application; };
export const listAdminApplications = async (query) => {
  const filter = { isArchived: query.archived }; if (query.company) filter.company = query.company; if (query.job) filter.job = query.job; if (query.candidate) filter.candidate = query.candidate; if (query.status) filter.status = query.status;
  if (query.submittedFrom || query.submittedTo) filter.submittedAt = { ...(query.submittedFrom && { $gte: query.submittedFrom }), ...(query.submittedTo && { $lte: query.submittedTo }) };
  const [applications, total] = await Promise.all([Application.find(filter).sort({ submittedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), Application.countDocuments(filter)]);
  return { applications, pagination: buildPagination(query.page, query.limit, total) };
};
export const getAdminApplication = find;
export const overrideApplicationStatus = async (id, adminId, input) => { const application = await find(id); changeApplicationStatus(application, input.status, adminId, input.reason, { adminOverride: true }); await application.save(); return application; };
export const archiveApplication = async (id) => { const application = await find(id); application.isArchived = true; await application.save(); return application; };
export const deleteApplicationNoteAsAdmin = async (applicationId, noteId) => { const application = await find(applicationId); const note = application.recruiterNotes.id(noteId); if (!note) throw new AppError('Recruiter note not found', 404); note.deleteOne(); await application.save(); };
