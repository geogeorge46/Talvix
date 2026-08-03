import {
  transferCompanyOwnership,
  adminRemoveMember,
  adminApproveMember,
  restoreCompany,
  listAllClaims,
  resolveOwnershipClaim,
} from '../services/adminOverrides.service.js';

export const transferCompanyOwnershipController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const company = await transferCompanyOwnership(
      request.params.companyId,
      request.body.newOwnerId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Company ownership transferred successfully',
      data: { company },
    });
  } catch (error) {
    return next(error);
  }
};

export const adminRemoveMemberController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    await adminRemoveMember(
      request.params.companyId,
      request.params.memberId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Member removed from company successfully',
    });
  } catch (error) {
    return next(error);
  }
};

export const adminApproveMemberController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const member = await adminApproveMember(
      request.params.companyId,
      request.params.memberId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Member approved successfully',
      data: { member },
    });
  } catch (error) {
    return next(error);
  }
};

export const restoreCompanyController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const company = await restoreCompany(
      request.params.companyId,
      request.user.id,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: 'Company restored successfully',
      data: { company },
    });
  } catch (error) {
    return next(error);
  }
};

export const listAllClaimsController = async (request, response, next) => {
  try {
    const claims = await listAllClaims();
    return response.json({
      success: true,
      message: 'Ownership claims retrieved successfully',
      data: { claims },
    });
  } catch (error) {
    return next(error);
  }
};

export const resolveOwnershipClaimController = async (request, response, next) => {
  try {
    const ip = request.ip || 'Unknown';
    const ua = request.headers['user-agent'] || 'Unknown';
    const claim = await resolveOwnershipClaim(
      request.params.claimId,
      request.user.id,
      request.body.action,
      request.body.notes,
      ip,
      ua
    );
    return response.json({
      success: true,
      message: `Ownership claim ${claim.status} successfully`,
      data: { claim },
    });
  } catch (error) {
    return next(error);
  }
};
