import { useState } from 'react';
import { Button, IconButton, Link } from './components';
import {
  Accordion,
  Breadcrumbs,
  Card,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  Dialog,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  List,
  LoadingState,
  Menu,
  MetricCard,
  PageHeader,
  Pagination,
  PendingApprovalState,
  PermissionState,
  SessionExpiredState,
  SuspendedState,
  Tabs,
  ToastProvider,
  Toolbar,
  UnverifiedCompanyState,
  useToast,
  type SortState,
} from './composites';

const rows = [
  { id: 'a', name: 'Alpha', state: 'Ready' },
  { id: 'b', name: 'Beta', state: 'Paused' },
];
const columns = [
  {
    id: 'name',
    header: 'Name',
    accessor: (r: (typeof rows)[number]) => r.name,
    sortable: true,
  },
  {
    id: 'state',
    header: 'State',
    accessor: (r: (typeof rows)[number]) => r.state,
  },
];
export function CompositeShowcase() {
  const [sort, setSort] = useState<SortState>();
  const [page, setPage] = useState(1);
  return (
    <ToastProvider>
      <main id="main-content" className="showcase" tabIndex={-1}>
        <PageHeader
          eyebrow="Phase 3 workshop"
          title="Composites and shared states"
          description="Domain-neutral patterns for dependable product work."
          primaryAction={<Button>Primary action</Button>}
          secondaryActions={<Button variant="secondary">Secondary</Button>}
        />
        <Section title="Surfaces and navigation">
          <div className="showcase-grid">
            <Card
              heading="Bordered card"
              description="A coherent content surface."
              actions={<Button variant="quiet">Action</Button>}
            >
              Composable content.
            </Card>
            <MetricCard
              label="Example measure"
              value="128"
              trend="Up 8%"
              trendTone="success"
              metadata="Updated recently"
            />
          </div>
          <Toolbar
            label="Example tools"
            start={<Button variant="secondary">Filter</Button>}
            end={<Button>Continue</Button>}
          />
          <Breadcrumbs
            items={[{ label: 'Library', href: '#' }, { label: 'Composites' }]}
          />
          <Pagination
            page={page}
            totalPages={4}
            onPageChange={setPage}
            ariaLabel="Showcase pagination"
          />
        </Section>
        <Section title="Overlays and disclosure">
          <div className="showcase-row">
            <Dialog
              trigger={<Button>Open dialog</Button>}
              title="Review details"
              description="Focus remains inside until closed."
              footer={<Button>Done</Button>}
            >
              Dialog content.
            </Dialog>
            <ConfirmDialog
              trigger={<Button variant="danger">Confirm action</Button>}
              title="Confirm action"
              description="This example demonstrates a consequential choice."
              variant="destructive"
              onConfirm={() => Promise.resolve()}
            />
            <Drawer
              trigger={<Button variant="secondary">Open drawer</Button>}
              title="Supporting panel"
              description="A responsive side sheet."
              side="end"
            >
              Drawer content.
            </Drawer>
            <Menu
              trigger={<Button variant="secondary">Menu</Button>}
              items={[
                { id: 'edit', label: 'Edit' },
                { id: 'disabled', label: 'Unavailable', disabled: true },
                { id: 'remove', label: 'Remove', destructive: true },
              ]}
            />
            <Dropdown
              trigger={<Button variant="secondary">Dropdown</Button>}
              items={[
                { id: 'one', label: 'First action' },
                { id: 'two', label: 'Second action' },
              ]}
            />
          </div>
          <Tabs
            items={[
              { id: 'first', label: 'First', content: 'First panel' },
              { id: 'second', label: 'Second', content: 'Second panel' },
              {
                id: 'third',
                label: 'Unavailable',
                content: '',
                disabled: true,
              },
            ]}
          />
          <Accordion
            items={[
              {
                id: 'a',
                title: 'What is this?',
                content: 'A keyboard-complete disclosure pattern.',
              },
              {
                id: 'b',
                title: 'Can it be disabled?',
                content: 'Yes.',
                disabled: true,
              },
            ]}
          />
        </Section>
        <Section title="Feedback and states">
          <ToastDemo />
          <div className="showcase-grid">
            <EmptyState
              title="Nothing here yet"
              description="Add an item when you are ready."
              action={<Button>Add item</Button>}
            />
            <FilteredEmptyState
              title="No matching items"
              description="Your current filters returned no results."
              onClear={() => undefined}
            />
            <ErrorState
              detail="The example could not be loaded."
              retry={() => undefined}
              referenceId="REF-123"
            />
            <LoadingState label="Loading examples" />
            <PermissionState />
            <SessionExpiredState onReauthenticate={() => undefined} />
            <PendingApprovalState />
            <SuspendedState />
            <UnverifiedCompanyState />
          </div>
        </Section>
        <Section title="Data and lists">
          <DataTable
            caption="Example records"
            rows={rows}
            rowKey={(r) => r.id}
            columns={columns}
            {...(sort ? { sort } : {})}
            onSort={setSort}
            renderNarrow={(r) => (
              <DescriptionList
                items={[
                  { term: 'Name', description: r.name },
                  { term: 'State', description: r.state },
                ]}
              />
            )}
            pagination={{
              page,
              totalPages: 4,
              onPageChange: setPage,
              ariaLabel: 'Example table pagination',
            }}
            rowActions={() => (
              <IconButton
                icon="⋯"
                aria-label="Record actions"
                variant="quiet"
              />
            )}
          />
          <DescriptionList
            variant="horizontal"
            items={[
              {
                term: 'Owner',
                description: 'Example person',
                action: <Link href="#">View</Link>,
              },
              { term: 'Created', description: 'Today' },
            ]}
          />
          <List
            items={['First item', 'Second item']}
            renderItem={(item) => item}
          />
          <DataTable
            caption="Loading records"
            rows={[]}
            rowKey={() => ''}
            columns={columns}
            isLoading
            renderNarrow={() => null}
          />
          <DataTable
            caption="Empty records"
            rows={[]}
            rowKey={() => ''}
            columns={columns}
            renderNarrow={() => null}
          />
          <DataTable
            caption="Failed records"
            rows={[]}
            rowKey={() => ''}
            columns={columns}
            error="Records are unavailable."
            renderNarrow={() => null}
          />
        </Section>
      </main>
    </ToastProvider>
  );
}
function ToastDemo() {
  const toast = useToast();
  return (
    <Button
      onClick={() =>
        toast.push({
          title: 'Example saved',
          message: 'This supplements the persistent outcome.',
          tone: 'success',
          action: { label: 'Undo', onAction: () => undefined },
        })
      }
    >
      Show toast
    </Button>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="showcase-section">
      <h2>{title}</h2>
      <div className="showcase-stack">{children}</div>
    </section>
  );
}
