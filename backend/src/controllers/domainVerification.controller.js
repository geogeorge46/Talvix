import {
  confirmDomainVerification,
  createDomainVerificationChallenge,
  getDomainVerificationStatus,
} from '../services/domainVerification.service.js';

export const createDomainChallengeController = async (req, res, next) => {
  try {
    const companyId = req.company?.id || req.company?._id;
    const { domain } = req.body;
    const result = await createDomainVerificationChallenge(
      companyId,
      req.user.id,
      domain,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const confirmDomainChallengeController = async (req, res, next) => {
  try {
    const companyId = req.company?.id || req.company?._id;
    const result = await confirmDomainVerification(
      companyId,
      req.user.id,
      undefined,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getDomainStatusController = async (req, res, next) => {
  try {
    const companyId = req.company?.id || req.company?._id;
    const status = await getDomainVerificationStatus(companyId);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};
