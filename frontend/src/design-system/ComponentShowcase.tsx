import { useState } from 'react';
import { Bell, Check, Sparkles } from 'lucide-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Combobox,
  DateField,
  Divider,
  ErrorSummary,
  FormActions,
  FormSection,
  IconButton,
  Link,
  Progress,
  RadioGroup,
  SearchField,
  Select,
  Skeleton,
  Spinner,
  StatusTag,
  Switch,
  TextArea,
  TextField,
  TimeField,
  Tooltip,
} from './components';
import { TokenPreview } from './TokenPreview';
import { CompositeShowcase } from './CompositeShowcase';
import './showcase.css';

const options = [
  { value: 'one', label: 'First option' },
  { value: 'two', label: 'Second option' },
  { value: 'three', label: 'Third option' },
];
export function ComponentShowcase() {
  const [view, setView] = useState<'components' | 'composites' | 'tokens'>(
    'composites',
  );
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('one');
  const [alert, setAlert] = useState(true);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to showcase
      </a>
      <header className="showcase-header">
        <div>
          <span className="eyebrow">Talvix design system · Phase 3</span>
          <strong>Frost Ledger system</strong>
        </div>
        <div role="group" aria-label="Showcase view">
          <Button
            variant={view === 'composites' ? 'primary' : 'quiet'}
            onClick={() => setView('composites')}
          >
            Composites
          </Button>
          <Button
            variant={view === 'components' ? 'primary' : 'quiet'}
            onClick={() => setView('components')}
          >
            Components
          </Button>
          <Button
            variant={view === 'tokens' ? 'primary' : 'quiet'}
            onClick={() => setView('tokens')}
          >
            Tokens
          </Button>
        </div>
      </header>
      {view === 'tokens' ? (
        <TokenPreview />
      ) : view === 'composites' ? (
        <CompositeShowcase />
      ) : (
        <main id="main-content" className="showcase" tabIndex={-1}>
          <section className="showcase-intro">
            <p className="kicker">Component workshop</p>
            <h1>
              Calm controls.
              <br />
              <em>Complete signals.</em>
            </h1>
            <p>
              Accessible, domain-neutral building blocks for clear product work.
            </p>
          </section>
          <Showcase title="Actions & navigation">
            <div className="showcase-row">
              <Button>Primary action</Button>
              <Button variant="secondary" leadingIcon={<Check size={16} />}>
                Secondary
              </Button>
              <Button variant="quiet">Quiet</Button>
              <Button variant="danger">Danger</Button>
              <Button loading loadingLabel="Saving">
                Save
              </Button>
              <Button disabled>Disabled</Button>
              <IconButton
                icon={<Bell />}
                aria-label="Notifications"
                variant="secondary"
              />
              <Link href="#forms">Inline link</Link>
              <Link href="https://example.com" target="_blank">
                External example
              </Link>
              <Tooltip content="Supplemental guidance">
                <Button variant="secondary">Focus or hover</Button>
              </Tooltip>
            </div>
          </Showcase>
          <Showcase title="Fields" id="forms">
            <div className="showcase-grid">
              <TextField
                label="Example label"
                hint="Helpful context for this field."
                placeholder="Enter text"
              />
              <TextField
                label="Invalid field"
                error="Enter a valid value."
                defaultValue="Incorrect"
              />
              <TextField label="Read-only field" readOnly value="Fixed value" />
              <TextArea
                label="Long response"
                placeholder="Write a concise response"
              />
              <Select label="Native select" options={options} />
              <Combobox label="Searchable choice" options={options} />
              <DateField label="Example date" />
              <TimeField label="Example time" />
              <SearchField label="Search examples" />
            </div>
          </Showcase>
          <Showcase title="Choices">
            <div className="showcase-grid">
              <Checkbox
                label="Include supporting detail"
                description="Adds optional context."
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <Checkbox label="Unavailable choice" disabled />
              <Switch
                label="Enable setting"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <Switch label="Read-only setting" checked readOnly />
              <RadioGroup
                legend="Choose one"
                name="example-radio"
                options={options}
                value={radio}
                onChange={setRadio}
              />
              <RadioGroup
                legend="Invalid choice"
                name="invalid-radio"
                options={options}
                error="Select an option."
              />
            </div>
          </Showcase>
          <Showcase title="Signals & identity">
            <div className="showcase-row">
              <Badge>Neutral badge</Badge>
              <Badge variant="accent">Accent badge</Badge>
              {(
                [
                  'neutral',
                  'success',
                  'warning',
                  'danger',
                  'info',
                  'ai',
                ] as const
              ).map((t) => (
                <StatusTag
                  tone={t}
                  icon={t === 'ai' ? <Sparkles size={14} /> : undefined}
                  key={t}
                >
                  {t}
                </StatusTag>
              ))}
              <Avatar name="Alex Rivera" />
              <Avatar name="Example Company" variant="company" size="lg" />
              <Progress value={68} label="Example progress" />
              <Progress label="Loading progress" />
              <Spinner label="Loading example" />
              <Skeleton style={{ width: 'var(--space-10)' }} />
            </div>
            <Divider />
          </Showcase>
          <Showcase title="Feedback & forms">
            <div className="showcase-stack">
              {alert && (
                <Alert
                  title="Useful information"
                  dismissible
                  onDismiss={() => setAlert(false)}
                >
                  <p>This persistent message explains what happens next.</p>
                </Alert>
              )}
              <Alert tone="success" title="Complete">
                <p>The example action completed.</p>
              </Alert>
              <Alert tone="warning" title="Review needed">
                <p>Check this information before continuing.</p>
              </Alert>
              <Alert tone="danger" title="Unable to continue" urgent>
                <p>Correct the highlighted fields.</p>
              </Alert>
              <ErrorSummary
                errors={[
                  {
                    fieldId: 'invalid-example',
                    message: 'Enter a valid example value.',
                  },
                ]}
              />
              <FormSection
                legend="Related fields"
                description="A semantic fieldset groups connected controls."
              >
                <TextField
                  id="invalid-example"
                  label="Grouped example"
                  error="Enter a valid example value."
                />
                <FormActions>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Continue</Button>
                </FormActions>
              </FormSection>
            </div>
          </Showcase>
        </main>
      )}
    </>
  );
}
function Showcase({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="showcase-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
