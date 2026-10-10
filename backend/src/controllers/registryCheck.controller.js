import {
  getCompanyVerificationSummary,
  getRegistryChecksForCompany,
  overrideRegistryCheck,
  runRegistryCheck
} from '../services/registryVerification.service.js';

export const runRegistryCheckController = async (req, res, next) => {
  try {
    const { checkType, provider, options } = req.body || {};
    const check = await runRegistryCheck({
      companyId: req.params.companyId,
      checkType,
      providerName: provider,
      options,
      actorId: req.user.id
    });
    return res.status(201).json({
      success: true,
      message: 'Registry check executed successfully',
      data: { check }
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyRegistryChecksController = async (req, res, next) => {
  try {
    const checks = await getRegistryChecksForCompany(req.params.companyId);
    return res.json({
      success: true,
      message: 'Registry checks retrieved successfully',
      data: { checks }
    });
  } catch (error) {
    return next(error);
  }
};

export const overrideRegistryCheckController = async (req, res, next) => {
  try {
    const check = await overrideRegistryCheck({
      companyId: req.params.companyId,
      checkId: req.params.checkId,
      adminUser: req.user,
      reason: req.body.reason
    });
    return res.json({
      success: true,
      message: 'Registry check overridden successfully',
      data: { check }
    });
  } catch (error) {
    return next(error);
  }
};

export const getCompanyVerificationSummaryController = async (req, res, next) => {
  try {
    const summary = await getCompanyVerificationSummary(req.company._id);
    return res.json({
      success: true,
      message: 'Company verification summary retrieved successfully',
      data: { summary }
    });
  } catch (error) {
    return next(error);
  }
};
