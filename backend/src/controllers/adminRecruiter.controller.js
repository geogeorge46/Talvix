import { approveRecruiter, listPendingRecruiters, rejectRecruiter, suspendRecruiter } from '../services/adminRecruiter.service.js';
const action = (service, message) => async (request, response, next) => { try { const profile = await service(request.params.recruiterId, request.user.id, request.body.reason); return response.json({ success: true, message, data: { profile } }); } catch (error) { return next(error); } };
export const pendingRecruiters = async (request, response, next) => { try { const data = await listPendingRecruiters(request.validatedQuery); return response.json({ success: true, message: 'Pending recruiters retrieved successfully', data }); } catch (error) { return next(error); } };
export const approveRecruiterAccount = action(approveRecruiter, 'Recruiter approved successfully');
export const rejectRecruiterAccount = action(rejectRecruiter, 'Recruiter rejected successfully');
export const suspendRecruiterAccount = action(suspendRecruiter, 'Recruiter suspended successfully');
