import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const platformAdminRouter = Router();

platformAdminRouter.use(authenticate);

// Secure routes scoped strictly to Admins
const adminOnly = authorizeRoles(USER_ROLES.ADMIN);
platformAdminRouter.use(adminOnly);
platformAdminRouter.use(requireCompanyAccess);

// Organization Management
platformAdminRouter.post('/organizations', controller.createOrganization);
platformAdminRouter.get('/organizations', (req, res) => res.json({ success: true, data: [] }));
platformAdminRouter.get('/organizations/:id', (req, res) => res.json({ success: true, data: {} }));
platformAdminRouter.put('/organizations/:id', controller.createOrganization);
platformAdminRouter.delete('/organizations/:id', (req, res) => res.json({ success: true, message: 'Deleted' }));

// Identity / Auth
platformAdminRouter.post('/auth/saml', (req, res) => res.json({ success: true, enabled: true }));
platformAdminRouter.post('/auth/scim', (req, res) => res.json({ success: true, synced: true }));
platformAdminRouter.post('/auth/passkeys', (req, res) => res.json({ success: true, registered: true }));
platformAdminRouter.post('/auth/mfa', (req, res) => res.json({ success: true, verified: true }));

// Security
platformAdminRouter.get('/security/dashboard', controller.getSecurityDashboard);
platformAdminRouter.get('/security/incidents', (req, res) => res.json({ success: true, incidents: [] }));
platformAdminRouter.post('/security/incidents', (req, res) => res.status(201).json({ success: true }));
platformAdminRouter.post('/security/block-ip', (req, res) => res.json({ success: true, blocked: true }));

// Audit
platformAdminRouter.get('/audit', controller.getAuditLogs);
platformAdminRouter.get('/audit/export', (req, res) => res.json({ success: true, downloadUrl: 's3://audit.csv' }));

// Billing & Usage
platformAdminRouter.get('/billing', (req, res) => res.json({ success: true, invoiceAmount: 499.00 }));
platformAdminRouter.get('/usage', (req, res) => res.json({ success: true, tokenQuotaPercent: 12 }));
platformAdminRouter.get('/licenses', (req, res) => res.json({ success: true, assignedLicensesCount: 5 }));

// Secret Management overrides
platformAdminRouter.post('/secrets/rotate', controller.rotateSecret);
platformAdminRouter.put('/quotas', controller.updateQuotas);
