import fs from 'node:fs';
import path from 'node:path';

const tokenDirectory = path.resolve('src/design-system/tokens');
const semantic = fs.readFileSync(
  path.join(tokenDirectory, 'semantic.css'),
  'utf8',
);
const foundations = fs.readFileSync(
  path.join(tokenDirectory, 'foundations.css'),
  'utf8',
);

describe('design token contract', () => {
  it.each([
    'canvas',
    'surface-1',
    'text-strong',
    'border-default',
    'action-primary',
    'ai-fg',
    'success-fg',
    'warning-fg',
    'danger-fg',
    'selected',
    'hover',
    'focus',
    'disabled-bg',
  ])('defines --color-%s', (role) => {
    expect(semantic).toContain(`--color-${role}:`);
  });

  it('keeps every raw hex color in the reference source only', () => {
    const rawHexColor = /#[\da-f]{3,8}\b/gi;
    const files = walk(path.resolve('.')).filter(
      (file) =>
        !file.endsWith('reference.css') &&
        !file.endsWith('token-contract.test.ts') &&
        !file.includes(`${path.sep}node_modules${path.sep}`) &&
        !file.includes(`${path.sep}dist${path.sep}`) &&
        !file.includes(`${path.sep}coverage${path.sep}`) &&
        /\.(?:css|html|js|json|md|ts|tsx)$/.test(file),
    );
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(
        content.match(rawHexColor),
        `raw hex color found in ${file}`,
      ).toBeNull();
    }
  });

  it.each([
    'text-code',
    'leading-code',
    'weight-regular',
    'weight-medium',
    'weight-semibold',
    'weight-bold',
    'grid-columns',
    'grid-gutter',
    'grid-margin',
    'grid-content-columns',
    'grid-sidebar-columns',
  ])('defines --%s', (role) => {
    expect(foundations).toContain(`--${role}:`);
  });

  it('defines independent focus and AI semantic contracts', () => {
    expect(semantic).toContain('--color-focus-halo:');
    expect(semantic).toContain('--color-ai-fg: var(--ref-ai-700)');
    expect(semantic).not.toContain('--color-ai-fg: var(--ref-green-700)');
  });
});

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target;
  });
}
