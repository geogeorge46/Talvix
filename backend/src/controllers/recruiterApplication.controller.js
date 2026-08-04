import { addApplicationNote, assignApplicationRecruiters, deleteApplicationNote, executeBulkApplicationsOperation, getApplicationPipeline, getApplicationTimeline, getCompanyApplication, getJobApplicationStatistics, listCompanyApplications, rateApplication, tagApplication, updateApplicationNote, updateApplicationStatus } from '../services/recruiterApplication.service.js';
import { generateCandidateAnalysis } from '../services/ai.service.js';
export const managedApplications = async (request, response, next) => { try { const data = await listCompanyApplications(request.company.id, request.validatedQuery); return response.json({ success: true, message: 'Applications retrieved successfully', data }); } catch (error) { return next(error); } };
export const managedApplication = async (request, response, next) => { try { const application = await getCompanyApplication(request.company.id, request.params.applicationId); return response.json({ success: true, message: 'Application retrieved successfully', data: { application } }); } catch (error) { return next(error); } };
export const changeManagedApplicationStatus = async (request, response, next) => { try { const application = await updateApplicationStatus(request.company.id, request.params.applicationId, request.user.id, request.body); return response.json({ success: true, message: 'Application status updated successfully', data: { application } }); } catch (error) { return next(error); } };
export const addManagedApplicationNote = async (request, response, next) => { try { const note = await addApplicationNote(request.company.id, request.params.applicationId, request.user.id, request.body); return response.status(201).json({ success: true, message: 'Recruiter note added successfully', data: { note } }); } catch (error) { return next(error); } };
export const updateManagedApplicationNote = async (request, response, next) => { try { const note = await updateApplicationNote(request.company.id, request.params.applicationId, request.params.noteId, request.user.id, request.body); return response.json({ success: true, message: 'Recruiter note updated successfully', data: { note } }); } catch (error) { return next(error); } };
export const deleteManagedApplicationNote = async (request, response, next) => { try { await deleteApplicationNote(request.company.id, request.params.applicationId, request.params.noteId, request.user.id, request.recruiterProfile.isCompanyOwner); return response.json({ success: true, message: 'Recruiter note deleted successfully' }); } catch (error) { return next(error); } };
export const rateManagedApplication = async (request, response, next) => { try { const application = await rateApplication(request.company.id, request.params.applicationId, request.user.id, request.body.rating); return response.json({ success: true, message: 'Application rating updated successfully', data: { application } }); } catch (error) { return next(error); } };
export const tagManagedApplication = async (request, response, next) => { try { const application = await tagApplication(request.company.id, request.params.applicationId, request.body.tags); return response.json({ success: true, message: 'Application tags updated successfully', data: { application } }); } catch (error) { return next(error); } };
export const assignManagedApplication = async (request, response, next) => { try { const application = await assignApplicationRecruiters(request.company, request.params.applicationId, request.body.recruiterIds); return response.json({ success: true, message: 'Application assignees updated successfully', data: { application } }); } catch (error) { return next(error); } };
export const applicationPipeline = async (request, response, next) => { try { const data = await getApplicationPipeline(request.company.id, request.validatedQuery.jobId); return response.json({ success: true, message: 'Application pipeline retrieved successfully', data }); } catch (error) { return next(error); } };
export const jobApplicationStatistics = async (request, response, next) => { try { const statistics = await getJobApplicationStatistics(request.company.id, request.params.jobId); return response.json({ success: true, message: 'Job application statistics retrieved successfully', data: { statistics } }); } catch (error) { return next(error); } };
export const bulkManagedApplications = async (request, response, next) => { try { const applications = await executeBulkApplicationsOperation(request.company, request.body.action, request.body.applicationIds, request.body.payload, request.user.id); return response.json({ success: true, message: 'Bulk operation executed successfully', data: { applications } }); } catch (error) { return next(error); } };
export const managedApplicationTimeline = async (request, response, next) => { try { const timeline = await getApplicationTimeline(request.company.id, request.params.applicationId); return response.json({ success: true, message: 'Application timeline retrieved successfully', data: { timeline } }); } catch (error) { return next(error); } };
export const managedApplicationAiAnalysis = async (request, response, next) => {
  try {
    const application = await getCompanyApplication(request.company.id, request.params.applicationId);
    const jobDetails = {
      title: application.jobSnapshot.title,
      description: application.jobSnapshot.description,
      skills: application.jobSnapshot.skills
    };
    const candidateDetails = {
      fullName: application.candidateSnapshot.fullName,
      headline: application.candidateSnapshot.headline,
      skills: application.candidateSnapshot.skills,
      experience: application.candidateSnapshot.experience,
      education: application.candidateSnapshot.education
    };
    const analysis = await generateCandidateAnalysis(jobDetails, candidateDetails);
    return response.json({ success: true, message: 'AI candidate analysis completed successfully', data: { analysis } });
  } catch (error) {
    return next(error);
  }
};
