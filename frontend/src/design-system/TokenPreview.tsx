import './token-preview.css';

const references = [
  'steel-gray',
  'caribbean-green',
  'texas-rose',
  'wafer',
  'snow',
] as const;
const semanticColors = [
  'canvas',
  'surface-1',
  'surface-2',
  'surface-raised',
  'surface-glass',
  'text-strong',
  'text-default',
  'text-muted',
  'text-inverse',
  'text-disabled',
  'border-default',
  'border-subtle',
  'border-strong',
  'action-primary',
  'action-hover',
  'action-pressed',
  'ai-fg',
  'ai-bg',
  'ai-border',
  'success-fg',
  'success-bg',
  'success-border',
  'warning-fg',
  'warning-bg',
  'warning-border',
  'danger-fg',
  'danger-bg',
  'danger-border',
  'info-fg',
  'info-bg',
  'selected',
  'hover',
  'focus',
  'focus-halo',
  'disabled-bg',
  'overlay',
  'selection',
] as const;
const statuses = [
  ['success', 'Success', 'Ready to proceed'],
  ['warning', 'Warning', 'Review required'],
  ['danger', 'Error', 'Action unsuccessful'],
  ['info', 'Information', 'Additional context'],
  ['ai', 'AI signal', 'Human review required'],
] as const;
const spaces = ['0', 'half', '1', '2', '3', '4', '5', '6', '8', '10'] as const;

export function TokenPreview() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to token content
      </a>
      <header className="preview-header">
        <div>
          <span className="eyebrow">Talvix design system · Phase 1</span>
          <strong>Frost Ledger</strong>
        </div>
        <span className="version">Foundation / 0.1</span>
      </header>
      <main id="main-content" className="preview" tabIndex={-1}>
        <section className="intro" aria-labelledby="preview-title">
          <p className="kicker">Token laboratory</p>
          <h1 id="preview-title">
            Quiet structure.
            <br />
            <em>Clear signals.</em>
          </h1>
          <p>
            A development-only reference for the visual and accessibility
            foundations of Talvix.
          </p>
        </section>
        <PreviewSection number="01" title="Color system">
          <h3>Brand references</h3>
          <div className="brand-strip">
            {references.map((x) => (
              <article className={`brand brand-${x}`} key={x}>
                <span>
                  {x.replaceAll('-', ' ')}
                  <ResolvedValue variable={`--ref-${x}`} />
                </span>
              </article>
            ))}
          </div>
          <h3>Semantic roles</h3>
          <div className="swatch-grid">
            {semanticColors.map((x) => (
              <article key={x} className="swatch">
                <span
                  className="swatch-color"
                  style={{ background: `var(--color-${x})` }}
                />
                <code>
                  --color-{x}
                  <ResolvedValue variable={`--color-${x}`} />
                </code>
              </article>
            ))}
          </div>
        </PreviewSection>
        <PreviewSection number="02" title="Typography">
          <div className="type-specimens">
            <p className="type-display">Evidence-led hiring</p>
            <p className="type-title">A confident page title</p>
            <p className="type-section">Section title for structured work</p>
            <p className="type-heading">Heading specimen · Semibold</p>
            <p className="type-body-lg">
              Body large · Regular evidence summary
            </p>
            <p className="type-body">
              Geist keeps dense product information calm and legible. The
              hierarchy is compact, deliberate, and designed for long working
              sessions.
            </p>
            <p className="type-body-sm">Body small · Supporting instructions</p>
            <p className="type-label">Label · Medium · Tracked</p>
            <p className="type-caption">Caption · Regular</p>
            <p className="type-metadata">Metadata · 11px</p>
            <code className="type-code">
              const evidence = 'human-reviewed';
            </code>
            <div className="weight-row">
              <span className="weight-regular">400 Regular</span>
              <span className="weight-medium">500 Medium</span>
              <span className="weight-semibold">600 Semibold</span>
              <span className="weight-bold">700 Bold</span>
            </div>
          </div>
        </PreviewSection>
        <PreviewSection number="03" title="Spacing & geometry">
          <div className="space-list">
            {spaces.map((x) => (
              <div key={x}>
                <code>space-{x}</code>
                <i style={{ width: `var(--space-${x})` }} />
              </div>
            ))}
          </div>
          <div className="alias-row">
            <span>control · 8</span>
            <span>form · 16</span>
            <span>card · 16</span>
            <span>section · 32</span>
            <span>dashboard · 24</span>
          </div>
          <div className="geometry-row">
            {['sm', 'md', 'lg', 'xl'].map((x) => (
              <span className={`radius-${x}`} key={x}>
                radius {x}
              </span>
            ))}
          </div>
          <div className="border-row">
            <span className="border-thin-demo">1px default border</span>
            <span className="border-strong-demo">2px strong border</span>
            <span className="border-dashed-demo">1px dashed boundary</span>
          </div>
        </PreviewSection>
        <PreviewSection number="04" title="Depth & material">
          <div className="depth-row">
            <article className="shadow-xs">Shadow XS</article>
            <article className="shadow-sm">Shadow SM</article>
            <article className="shadow-md">Shadow MD</article>
            <article className="glass">82% glass · 12px blur</article>
            <article className="opacity-demo">48% disabled opacity</article>
          </div>
        </PreviewSection>
        <PreviewSection number="05" title="Status treatments">
          <div className="status-list">
            {statuses.map(([tone, label, copy]) => (
              <div className={`status status-${tone}`} key={tone}>
                <strong>{label}</strong>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </PreviewSection>
        <PreviewSection number="06" title="Interaction states">
          <div className="control-row">
            <button className="button-primary">Default</button>
            <button className="button-state-hover">Hover</button>
            <button className="button-state-pressed">Pressed</button>
            <button className="button-state-focus">Focus ring</button>
            <button className="button-secondary">Secondary action</button>
            <button className="button-primary" disabled>
              Disabled
            </button>
            <a className="text-link" href="#motion">
              Focusable text link
            </a>
          </div>
          <p className="hint">
            Use Tab to inspect the Steel Gray focus ring with its Snow halo.
            Pressed and hover states retain Steel Gray text for contrast.
          </p>
        </PreviewSection>
        <PreviewSection number="07" title="Motion & layers">
          <div id="motion" className="spec-table">
            <span>Instant</span>
            <code>80ms</code>
            <span>Fast</span>
            <code>140ms</code>
            <span>Moderate</span>
            <code>220ms</code>
            <span>Slow</span>
            <code>360ms</code>
            <span>Layer order</span>
            <code>base · sticky · dropdown · overlay · modal · toast</code>
            <span>Containers</span>
            <code>42rem · 72rem · 90rem</code>
            <span>Grid</span>
            <code>
              12 columns · 24px gutter · 32px margin · 8/4 content/sidebar
            </code>
            <span>Breakpoints</span>
            <code>40rem · 48rem · 64rem · 80rem</code>
            <span>Opacity</span>
            <code>disabled 48% · muted 72% · glass 82%</code>
            <span>Blur</span>
            <code>glass 12px</code>
          </div>
          <p className="hint">
            Reduced-motion preferences remove nonessential animation,
            transitions, and smooth scrolling.
          </p>
        </PreviewSection>
      </main>
    </>
  );
}

function ResolvedValue({ variable }: { variable: string }) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return <small>{value || variable}</small>;
}

function PreviewSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="preview-section" aria-labelledby={`section-${number}`}>
      <header>
        <span>{number}</span>
        <h2 id={`section-${number}`}>{title}</h2>
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}
