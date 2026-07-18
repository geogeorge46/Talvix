import {
  addCandidateEntries,
  deleteCandidateEntry,
  getCandidateProfileById,
  getOwnCandidateProfile,
  searchCandidateProfiles,
  updateCandidateEntry,
  updateOwnCandidateProfile,
} from '../services/candidate.service.js';

const collectionLabels = Object.freeze({
  education: 'Education',
  skills: 'Skill',
  experience: 'Experience',
  projects: 'Project',
  certifications: 'Certification',
});

/** Returns the authenticated candidate's complete profile. */
export const getMyCandidateProfile = async (request, response, next) => {
  try {
    const profile = await getOwnCandidateProfile(request.user.id);
    return response.status(200).json({
      success: true,
      message: 'Candidate profile retrieved successfully',
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

/** Updates the authenticated candidate's basic profile. */
export const updateMyCandidateProfile = async (request, response, next) => {
  try {
    const profile = await updateOwnCandidateProfile(request.user.id, request.body);
    return response.status(200).json({
      success: true,
      message: 'Candidate profile updated successfully',
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

/** Creates a controller for adding a validated nested profile entry. */
export const addCandidateCollectionEntries = (collectionName) => async (request, response, next) => {
  try {
    const entries = await addCandidateEntries(request.user.id, collectionName, request.body);
    return response.status(201).json({
      success: true,
      message: `${collectionLabels[collectionName]} added successfully`,
      data: { entries },
    });
  } catch (error) {
    return next(error);
  }
};

/** Creates a controller for updating a validated nested profile entry. */
export const updateCandidateCollectionEntry = (collectionName, parameterName) =>
  async (request, response, next) => {
    try {
      const entry = await updateCandidateEntry(
        request.user.id,
        collectionName,
        request.params[parameterName],
        request.body,
      );
      return response.status(200).json({
        success: true,
        message: `${collectionLabels[collectionName]} updated successfully`,
        data: { entry },
      });
    } catch (error) {
      return next(error);
    }
  };

/** Creates a controller for deleting a trusted nested profile entry. */
export const deleteCandidateCollectionEntry = (collectionName, parameterName) =>
  async (request, response, next) => {
    try {
      await deleteCandidateEntry(request.user.id, collectionName, request.params[parameterName]);
      return response.status(200).json({
        success: true,
        message: `${collectionLabels[collectionName]} deleted successfully`,
      });
    } catch (error) {
      return next(error);
    }
  };

/** Returns one visible candidate profile to a recruiter or administrator. */
export const getCandidateProfile = async (request, response, next) => {
  try {
    const profile = await getCandidateProfileById(request.params.candidateId, request.user.role);
    return response.status(200).json({
      success: true,
      message: 'Candidate profile retrieved successfully',
      data: { profile },
    });
  } catch (error) {
    return next(error);
  }
};

/** Returns filtered, paginated visible candidates. */
export const searchCandidates = async (request, response, next) => {
  try {
    const data = await searchCandidateProfiles(request.validatedQuery);
    return response.status(200).json({
      success: true,
      message: 'Candidates retrieved successfully',
      data,
    });
  } catch (error) {
    return next(error);
  }
};
