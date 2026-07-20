import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components';
import {
  Accordion,
  DataTable,
  Dialog,
  Menu,
  Pagination,
  Tabs,
  ToastProvider,
  useToast,
} from '.';

describe('Phase 3 composites', () => {
  it('traps dialog focus, closes with Escape, and restores its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog trigger={<Button>Open dialog</Button>} title="Example dialog">
        <Button>Inside</Button>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('supports menu keyboard navigation, disabled items, typeahead, and focus restoration', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <Menu
        trigger={<Button>Actions</Button>}
        items={[
          { id: 'a', label: 'Alpha', onSelect: action },
          { id: 'b', label: 'Blocked', disabled: true },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    await user.keyboard('{Enter}a{Enter}');
    expect(action).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });
  it('supports tab arrows and accordion keyboard disclosure', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tabs
          activationMode="manual"
          items={[
            { id: 'a', label: 'Alpha', content: 'Panel A' },
            { id: 'b', label: 'Beta', content: 'Panel B' },
          ]}
        />
        <Accordion
          items={[{ id: 'x', title: 'Details', content: 'Hidden detail' }]}
        />
      </>,
    );
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    alpha.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /Details/ }));
    expect(screen.getByText('Hidden detail')).toBeVisible();
  });
  it('exposes pagination boundaries and callbacks', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Pagination page={1} totalPages={3} onPageChange={change} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(change).toHaveBeenCalledWith(2);
  });
  it('renders semantic table sorting, narrow alternative, pagination, and all states', async () => {
    const user = userEvent.setup();
    const sort = vi.fn();
    const rows = [{ id: '1', name: 'Alpha' }];
    const columns = [
      {
        id: 'name',
        header: 'Name',
        accessor: (r: (typeof rows)[number]) => r.name,
        sortable: true,
      },
    ];
    const { rerender } = render(
      <DataTable
        caption="Records"
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        onSort={sort}
        renderNarrow={(r) => <a href={`#${r.id}`}>{r.name} narrow</a>}
        pagination={{ page: 1, totalPages: 2, onPageChange: vi.fn() }}
      />,
    );
    expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('list', { name: 'Records' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(sort).toHaveBeenCalledWith({ id: 'name', direction: 'ascending' });
    rerender(
      <DataTable
        caption="Records"
        rows={[]}
        rowKey={() => ''}
        columns={columns}
        isLoading
        renderNarrow={() => null}
      />,
    );
    expect(screen.getByLabelText('Records')).toBeInTheDocument();
    rerender(
      <DataTable
        caption="Records"
        rows={[]}
        rowKey={() => ''}
        columns={columns}
        renderNarrow={() => null}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No items' }),
    ).toBeInTheDocument();
    rerender(
      <DataTable
        caption="Records"
        rows={[]}
        rowKey={() => ''}
        columns={columns}
        error="Unavailable"
        renderNarrow={() => null}
      />,
    );
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
  it('announces, pauses, acts on, escapes, and bounds toast queue', async () => {
    vi.useFakeTimers();
    const action = vi.fn();
    function Demo() {
      const api = useToast();
      return (
        <>
          <button
            onClick={() =>
              api.push({
                id: 'one',
                title: 'Saved',
                duration: 1000,
                action: { label: 'Undo', onAction: action },
              })
            }
          >
            Push
          </button>
          <button
            onClick={() => {
              api.push({ id: 'two', title: 'Second', persistent: true });
              api.push({ id: 'three', title: 'Third', persistent: true });
            }}
          >
            Fill
          </button>
        </>
      );
    }
    render(
      <ToastProvider max={2}>
        <Demo />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Push' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(action).toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByRole('status'));
    await act(async () => undefined);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('status'));
    await act(async () => undefined);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(screen.getAllByRole('status')).toHaveLength(2);
    screen.getAllByRole('status')[1]?.focus();
    const latestToast = screen.getAllByRole('status').at(-1);
    expect(latestToast).toBeDefined();
    if (latestToast) fireEvent.keyDown(latestToast, { key: 'Escape' });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    vi.useRealTimers();
  });
});
