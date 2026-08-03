import {
  inviteRecruiter,
  getInvitationDetails,
  acceptInvitation,
  createJoinRequest,
  listJoinRequests,
  reviewJoinRequest,
  submitOwnershipClaim,
  respondToOwnershipClaim,
  listCompanyInvitations,
  resendInvitation,
  cancelInvitation,
} from '../services/companyInviteJoinClaim.service.js';

export const inviteRecruiterController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const result = await inviteRecruiter(request.company, request.user.id, request.body, ip, ua);
    return response.status(201).json({
      success: true,
      message: 'Invitation created successfully',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getInvitationDetailsController = async (request, response, next) => {
  try {
    const invitation = await getInvitationDetails(request.params.token);
    return response.json({
      success: true,
      message: 'Invitation details retrieved successfully',
      data: { invitation },
    });
  } catch (error) {
    return next(error);
  }
};

export const acceptInvitationController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const member = await acceptInvitation(request.user.id, request.params.token, ip, ua);
    return response.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: { member },
    });
  } catch (error) {
    return next(error);
  }
};

export const createJoinRequestController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const result = await createJoinRequest(request.user.id, request.params.companyId, ip, ua);
    return response.status(201).json({
      success: true,
      message: result.status === 'approved' ? 'Successfully joined company' : 'Join request submitted',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const listJoinRequestsController = async (request, response, next) => {
  try {
    const requests = await listJoinRequests(request.company._id);
    return response.json({
      success: true,
      message: 'Join requests retrieved successfully',
      data: { requests },
    });
  } catch (error) {
    return next(error);
  }
};

export const reviewJoinRequestController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const requestDoc = await reviewJoinRequest(
      request.company,
      request.params.requestId,
      request.user.id,
      request.body.action,
      request.body.notes,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: `Join request ${requestDoc.status} successfully`,
      data: { request: requestDoc },
    });
  } catch (error) {
    return next(error);
  }
};

export const submitOwnershipClaimController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const {
      officialEmail,
      linkedinUrl,
      proofUrl,
      companyWebsite,
      businessRegistration,
      gstNumber,
      uploadedDocuments,
      claimantNotes,
    } = request.body;
    const claim = await submitOwnershipClaim(
      request.user.id,
      request.params.companyId,
      officialEmail,
      linkedinUrl,
      proofUrl,
      { companyWebsite, businessRegistration, gstNumber, uploadedDocuments, claimantNotes },
      ip,
      ua
    );
    return response.status(201).json({
      success: true,
      message: 'Ownership claim submitted successfully',
      data: { claim },
    });
  } catch (error) {
    return next(error);
  }
};

export const respondToOwnershipClaimController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const { responseText } = request.body;
    const claim = await respondToOwnershipClaim(
      request.params.claimId,
      request.user.id,
      responseText,
      ip,
      ua
    );
    return response.status(200).json({
      success: true,
      message: 'Claim response submitted successfully',
      data: { claim },
    });
  } catch (error) {
    return next(error);
  }
};

export const listCompanyInvitationsController = async (request, response, next) => {
  try {
    const invitations = await listCompanyInvitations(request.company._id);
    return response.json({
      success: true,
      message: 'Invitations retrieved successfully',
      data: { invitations },
    });
  } catch (error) {
    return next(error);
  }
};

export const resendInvitationController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const result = await resendInvitation(
      request.company._id,
      request.params.invitationId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Invitation resent successfully',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelInvitationController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const invitation = await cancelInvitation(
      request.company._id,
      request.params.invitationId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Invitation cancelled successfully',
      data: { invitation },
    });
  } catch (error) {
    return next(error);
  }
};
