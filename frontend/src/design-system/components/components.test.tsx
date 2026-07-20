import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import {
  Button,
  Checkbox,
  Combobox,
  ErrorSummary,
  IconButton,
  Progress,
  SearchField,
  Spinner,
  Switch,
  TextField,
  Tooltip,
} from '.';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
describe('design-system primitives', () => {
  it('names icon-only and loading controls and blocks activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <IconButton icon="!" aria-label="Notify" />
        <Button loading onClick={onClick}>
          Save
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Notify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Loading' }));
    expect(onClick).not.toHaveBeenCalled();
  });
  it('connects invalid field help and forwards focus', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(
      <TextField
        ref={ref}
        label="Email"
        hint="Work address"
        error="Invalid address"
      />,
    );
    const input = screen.getByRole('textbox', { name: /Email/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('error');
    ref.current?.focus();
    expect(input).toHaveFocus();
  });
  it('supports combobox keyboard selection and escape', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Combobox label="Choice" options={options} onChange={change} />);
    const combo = screen.getByRole('combobox', { name: 'Choice' });
    await user.click(combo);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(change).toHaveBeenCalledWith('a');
    await user.click(combo);
    await user.keyboard('{Escape}');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });
  it('supports checkboxes, switch readonly, and disabled state', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <>
        <Checkbox label="Check" onChange={change} />
        <Switch label="Fixed" checked readOnly onChange={change} />
        <Checkbox label="Off" disabled />
      </>,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Check' }));
    expect(change).toHaveBeenCalledTimes(1);
    const fixed = screen.getByRole('switch', { name: 'Fixed' });
    await user.click(fixed);
    expect(change).toHaveBeenCalledTimes(1);
    expect(fixed).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Off' })).toBeDisabled();
  });
  it('clears search with Escape and clear button', async () => {
    const user = userEvent.setup();
    render(<SearchField label="Find" defaultValue="query" />);
    const input = screen.getByRole('searchbox', { name: /Find/ });
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    await user.type(input, 'again');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });
  it('shows tooltip on focus and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Details" delay={0}>
        <button>Help</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Help' });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Details');
    expect(trigger).toHaveAccessibleDescription('Details');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('guards read-only native values and completes combobox keys', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Checkbox label="Readonly checkbox" defaultChecked readOnly />
        <select aria-label="plain" defaultValue="a" disabled>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
        <Combobox
          label="Keys"
          options={options}
          hint="Choose carefully"
          error="Required"
        />
      </>,
    );
    const check = screen.getByRole('checkbox', { name: 'Readonly checkbox' });
    expect(check).toBeDisabled();
    expect(check).toBeChecked();
    const combo = screen.getByRole('combobox', { name: 'Keys' });
    expect(combo).toHaveAttribute('aria-describedby');
    await user.click(combo);
    await user.keyboard('{End}{Enter}');
    expect(combo).toHaveValue('Beta');
    await user.click(combo);
    await user.keyboard('{Home}{Enter}');
    expect(combo).toHaveValue('Alpha');
    await user.click(combo);
    await user.keyboard('{Tab}');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });
  it('focuses an invalid field from the error summary', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ErrorSummary errors={[{ fieldId: 'target', message: 'Fix target' }]} />
        <input id="target" />
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Fix target' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('target')).toHaveFocus();
  });
  it('provides accessible progress and spinner names', () => {
    render(
      <>
        <Progress value={50} label="Completion" />
        <Spinner label="Working" />
      </>,
    );
    expect(
      screen.getByRole('progressbar', { name: 'Completion' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Working' })).toBeInTheDocument();
  });
  it('has no representative axe violations', async () => {
    const { container } = render(
      <>
        <TextField label="Name" />
        <Checkbox label="Agree" />
        <Progress value={25} label="Completion" />
      </>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
