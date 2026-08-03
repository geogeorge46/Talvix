import { AuditLog } from '../models/AuditLog.js';
import { JoinRequest } from '../models/JoinRequest.js';
import { AppError } from '../shared/errors/AppError.js';

// List of known temporary/disposable email domains to prevent fake recruiter registration
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'yopmail.com',
  'tempmail.com',
  '10minutemail.com',
  'trashmail.com',
]);

export const securityMonitor = {
  /**
   * Tracks and blocks spam join requests.
   * If a user submits more than 5 join requests within 10 minutes, block them.
   */
  async trackJoinRequest(userId, ipAddress) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const count = await JoinRequest.countDocuments({
      user: userId,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (count >= 5) {
      await AuditLog.create({
        action: 'security.abuse_alert',
        actor: userId,
        oldValue: { count, ipAddress },
        newValue: { alert: 'Spam Join Requests Detected' },
        ipAddress,
        timestamp: new Date(),
      });
      throw new AppError('Too many join requests submitted. Please try again later.', 429);
    }
  },

  /**
   * Monitors and alerts on bulk profile exports or downloads.
   */
  async trackProfileExport(userId, count, ipAddress, userAgent = 'Unknown') {
    // If a user exports or downloads more than 50 profiles at once, flag it
    if (count > 50) {
      await AuditLog.create({
        action: 'security.bulk_download_alert',
        actor: userId,
        oldValue: null,
        newValue: { count, threshold: 50 },
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });
    }
  },

  /**
   * Validates signup emails against disposable/spam domain rules.
   */
  async validateRecruiterRegistration(email, ipAddress) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (DISPOSABLE_DOMAINS.has(domain)) {
      throw new AppError('Disposable or temporary email addresses are not permitted.', 400);
    }
  },
};
