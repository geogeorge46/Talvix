import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDesktopShell } from './Shell';
import './shell.css';
const shellCss = readFileSync(
  join(process.cwd(), 'src', 'shell', 'shell.css'),
  'utf8',
);
describe('responsive shell contract', () => {
  it('uses the approved desktop breakpoint and dimensions', () => {
    const style = document.createElement('style');
    style.textContent = shellCss;
    document.head.append(style);
    expect(shellCss).toContain('--shell-sidebar-width: 16rem');
    expect(shellCss).toContain('--shell-top-height: 4rem');
    expect(shellCss).toContain('@media (min-width: 64rem)');
    expect(shellCss).toContain('flex-wrap: wrap');
    expect(isDesktopShell(1023)).toBe(false);
    expect(isDesktopShell(1024)).toBe(true);
    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--shell-sidebar-width')
        .trim(),
    ).toBe('16rem');
    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--shell-top-height')
        .trim(),
    ).toBe('4rem');
    style.remove();
  });
});
