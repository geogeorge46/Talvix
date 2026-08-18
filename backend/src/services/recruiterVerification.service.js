import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { AuditLog } from '../models/AuditLog.js';
import { RecruiterVerificationHistory } from '../models/RecruiterVerificationHistory.js';
import { CompanyVerificationHistory } from '../models/CompanyVerificationHistory.js';
import { AppError } from '../shared/errors/AppError.js';

const databaseSupportsTransactions = () =>
  ['ReplicaSetWithPrimary', 'Sharded'].includes(
    mongoose.connection.client?.topology?.description?.type,
  );

export const submitRecruiterVerification = async (userId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const profile = await RecruiterProfile.findOne({ user: userId });
  if (!profile) {
    throw new AppError('Recruiter profile not found', 404);
  }
  if (!profile.designation) {
    throw new AppError('Please complete step 1 (your personal profile) before submitting.', 400);
  }
  if (!profile.company) {
    throw new AppError('Please complete step 2 (associate with a company) before submitting.', 400);
  }

  const company = await Company.findById(profile.company);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const membership = await CompanyMember.findOne({ company: company._id, recruiter: userId });
  if (!membership) {
    throw new AppError('Valid company membership is required before submitting.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.recruiterVerificationStatus === 'verified' && company.verificationStatus === 'verified') {
    throw new AppError('Recruiter and company are already verified.', 400);
  }
  if (user.recruiterVerificationStatus === 'pending' && company.verificationStatus === 'pending') {
    throw new AppError('Verification request is already pending.', 400);
  }

  const oldRecruiterStatus = user.recruiterVerificationStatus;
  const oldCompanyStatus = company.verificationStatus;

  const performOperations = async (session) => {
    // 1. Update recruiter verification status (if not already verified) and clear profile metadata
    let newRecruiterStatus = oldRecruiterStatus;
    if (oldRecruiterStatus !== 'verified') {
      user.recruiterVerificationStatus = 'pending';
      await user.save({ session });
      newRecruiterStatus = 'pending';

      const historyAction = oldRecruiterStatus === 'none' ? 'verification.submitted' : 'verification.resubmitted';
      await RecruiterVerificationHistory.create([{
        recruiterId: user._id,
        action: historyAction,
        previousStatus: oldRecruiterStatus,
        newStatus: 'pending',
        performedBy: user._id,
        performedByName: user.fullName || 'Recruiter',
        timestamp: new Date()
      }], { session });
    }

    profile.rejectionReason = '';
    profile.rejectedBy = null;
    profile.rejectedAt = null;
    profile.suspendedBy = null;
    profile.suspendedAt = null;
    profile.suspensionReason = '';
    await profile.save({ session });

    // 2. If company verification status is 'none' or 'rejected', transition to 'pending' and clear metadata
    let newCompanyStatus = oldCompanyStatus;
    if (oldCompanyStatus === 'none' || oldCompanyStatus === 'rejected') {
      company.verificationStatus = 'pending';
      company.rejectionReason = '';
      company.verifiedBy = null;
      company.verifiedAt = null;
      company.rejectedBy = null;
      company.rejectedAt = null;
      company.suspendedBy = null;
      company.suspendedAt = null;
      company.suspensionReason = '';
      await company.save({ session });
      newCompanyStatus = 'pending';

      const historyAction = oldCompanyStatus === 'none' ? 'verification.submitted' : 'verification.resubmitted';
      await CompanyVerificationHistory.create([{
        companyId: company._id,
        action: historyAction,
        previousStatus: oldCompanyStatus,
        newStatus: 'pending',
        performedBy: user._id,
        performedByName: user.fullName || 'Recruiter',
        timestamp: new Date()
      }], { session });
    }

    // 3. Log Audit event
    await AuditLog.create([{
      action: 'recruiter.verification.submitted',
      actor: userId,
      company: company._id,
      oldValue: { recruiterVerificationStatus: oldRecruiterStatus, companyVerificationStatus: oldCompanyStatus },
      newValue: { recruiterVerificationStatus: newRecruiterStatus, companyVerificationStatus: newCompanyStatus },
      ipAddress,
      userAgent
    }], { session });

    return {
      recruiterVerificationStatus: newRecruiterStatus,
      companyVerificationStatus: newCompanyStatus
    };
  };

  if (databaseSupportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await performOperations(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  } else {
    return performOperations();
  }
};
