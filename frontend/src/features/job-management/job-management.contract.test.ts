import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const page = readFileSync(
  resolve(process.cwd(), 'src/features/job-management/JobManagementPages.tsx'),
  'utf8',
);
const api = readFileSync(
  resolve(process.cwd(), 'src/features/job-management/api.ts'),
  'utf8',
);
describe('Phase 6 safety contracts', () => {
  it('never exposes the forbidden recruiter publish action', () => {
    expect(page).not.toMatch(/['"]publish['"]/);
    expect(api).not.toMatch(/\/publish/);
  });
  it('uses persisted permissions without owner bypass', () =>
    expect(page).not.toMatch(/isCompanyOwner/));
  it('guards managed queries and create-only success', () => {
    expect(api).toContain('enabled,');
    expect(page).toContain("mode === 'edit' && a.has('jobs.update')");
    expect(page).toContain('createdWithoutRead');
  });
  it('provides responsive deadline and lifecycle contracts', () => {
    expect(page).toContain("id: 'deadline'");
    expect(page).toContain('<JobRowActions');
    expect(page).toContain('No deadline');
  });
  it('provides stale reconciliation and unsaved exit boundaries', () => {
    expect(page).toContain('error.status === 409');
    expect(page).toContain("addEventListener('beforeunload'");
    expect(page).toContain('Discard unsaved changes?');
  });
});
