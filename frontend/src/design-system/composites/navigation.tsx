import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { type ReactNode } from 'react';
import { Button, Link } from '../components';

export interface MenuItem {
  kind?: 'item';
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
}
export interface MenuLabel {
  id: string;
  kind: 'label';
  label: string;
}
export interface MenuSeparator {
  id: string;
  kind: 'separator';
}
export type MenuEntry = MenuItem | MenuLabel | MenuSeparator;
export function Menu({
  trigger,
  label = 'Actions',
  items,
}: {
  trigger: ReactNode;
  label?: string;
  items: MenuEntry[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="tvx-menu"
          aria-label={label}
          sideOffset={4}
        >
          {items.map((i) =>
            i.kind === 'label' ? (
              <DropdownMenu.Label key={i.id}>{i.label}</DropdownMenu.Label>
            ) : i.kind === 'separator' ? (
              <DropdownMenu.Separator key={i.id} />
            ) : (
              <DropdownMenu.Item
                key={i.id}
                {...(i.disabled === undefined ? {} : { disabled: i.disabled })}
                className={i.destructive ? 'is-destructive' : ''}
                {...(i.onSelect ? { onSelect: i.onSelect } : {})}
              >
                {i.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function Dropdown({
  trigger,
  label,
  items,
  value,
  onValueChange,
}: {
  trigger: ReactNode;
  label?: string;
  items: MenuItem[];
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="tvx-menu"
          aria-label={label ?? 'Choose an option'}
        >
          <DropdownMenu.RadioGroup
            {...(value === undefined ? {} : { value })}
            {...(onValueChange ? { onValueChange } : {})}
          >
            {items.map((i) => (
              <DropdownMenu.RadioItem
                key={i.id}
                value={i.id}
                {...(i.disabled === undefined ? {} : { disabled: i.disabled })}
              >
                <DropdownMenu.ItemIndicator aria-hidden>
                  ✓
                </DropdownMenu.ItemIndicator>
                {i.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
}) {
  const initial = defaultValue ?? items[0]?.id;
  return (
    <TabsPrimitive.Root
      className={`tvx-tabs tvx-tabs--${orientation}`}
      {...(value === undefined ? {} : { value })}
      {...(initial === undefined ? {} : { defaultValue: initial })}
      {...(onValueChange ? { onValueChange } : {})}
      orientation={orientation}
      activationMode={activationMode}
    >
      <TabsPrimitive.List aria-label="Sections">
        {items.map((i) => (
          <TabsPrimitive.Trigger
            key={i.id}
            value={i.id}
            {...(i.disabled === undefined ? {} : { disabled: i.disabled })}
          >
            {i.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((i) => (
        <TabsPrimitive.Content key={i.id} value={i.id}>
          {i.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
export function Accordion({
  items,
  type = 'single',
  defaultValue,
  headingLevel = 3,
}: {
  items: {
    id: string;
    title: ReactNode;
    content: ReactNode;
    disabled?: boolean;
  }[];
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}) {
  return type === 'multiple' ? (
    <AccordionPrimitive.Root
      type="multiple"
      className="tvx-accordion"
      {...(Array.isArray(defaultValue) ? { defaultValue } : {})}
    >
      {items.map((i) => (
        <AccordionItem key={i.id} {...i} headingLevel={headingLevel} />
      ))}
    </AccordionPrimitive.Root>
  ) : (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      className="tvx-accordion"
      {...(typeof defaultValue === 'string' ? { defaultValue } : {})}
    >
      {items.map((i) => (
        <AccordionItem key={i.id} {...i} headingLevel={headingLevel} />
      ))}
    </AccordionPrimitive.Root>
  );
}
function AccordionItem({
  id,
  title,
  content,
  disabled,
  headingLevel,
}: {
  id: string;
  title: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  headingLevel: 2 | 3 | 4 | 5 | 6;
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <AccordionPrimitive.Item
      value={id}
      {...(disabled === undefined ? {} : { disabled })}
    >
      <Heading>
        <AccordionPrimitive.Trigger>
          {title}
          <span aria-hidden>⌄</span>
        </AccordionPrimitive.Trigger>
      </Heading>
      <AccordionPrimitive.Content>
        <div>{content}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="tvx-breadcrumbs">
        {items.map((i, n) => (
          <li key={`${i.label}-${n}`}>
            {n === items.length - 1 ? (
              <span aria-current="page">{i.label}</span>
            ) : (
              <>
                <Link href={i.href}>{i.label}</Link>
                <span aria-hidden> / </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function Pagination({
  page,
  totalPages,
  onPageChange,
  mode = 'numbered',
  loading = false,
  ariaLabel = 'Pagination',
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  mode?: 'numbered' | 'compact';
  loading?: boolean;
  ariaLabel?: string;
}) {
  const candidates = [1, totalPages, page - 1, page, page + 1].filter(
    (p) => p >= 1 && p <= totalPages,
  );
  const pages = [...new Set(candidates)].sort((a, b) => a - b);
  return (
    <nav
      className="tvx-pagination"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      <Button
        variant="secondary"
        disabled={loading || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      {mode === 'numbered' &&
        pages.map((p, index) => (
          <span key={p} className="tvx-pagination__item">
            {index > 0 && p - (pages[index - 1] ?? p) > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <Button
              variant={p === page ? 'primary' : 'quiet'}
              aria-current={p === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          </span>
        ))}
      <span className="visually-hidden">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={loading || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
