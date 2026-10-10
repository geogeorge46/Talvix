import {
  confirmEmailVerification,
  getEmailVerificationStatus,
  resendVerificationEmailSafe,
} from '../services/emailVerification.service.js';

export const resendEmailVerification = async (req, res, next) => {
  try {
    const target = req.user?.id || req.body?.email;
    const result = await resendVerificationEmailSafe(
      target,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const confirmEmailVerificationController = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await confirmEmailVerification(
      token,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getEmailVerificationStatusController = async (req, res, next) => {
  try {
    const status = await getEmailVerificationStatus(req.user.id);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};
