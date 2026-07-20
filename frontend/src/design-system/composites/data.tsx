import { type ReactNode } from 'react';
import { Button, Skeleton } from '../components';
import { ErrorState, EmptyState } from './states';
import { Pagination } from './navigation';

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
}
export interface SortState {
  id: string;
  direction: 'ascending' | 'descending';
}
export function DataTable<T>({
  caption,
  rows,
  rowKey,
  columns,
  sort,
  onSort,
  isLoading = false,
  error,
  empty,
  renderNarrow,
  pagination,
  rowActions,
}: {
  caption: string;
  rows: T[];
  rowKey: (r: T) => string;
  columns: DataColumn<T>[];
  sort?: SortState;
  onSort?: (s: SortState) => void;
  isLoading?: boolean;
  error?: string;
  empty?: ReactNode;
  renderNarrow: (r: T) => ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
    ariaLabel?: string;
  };
  rowActions?: (r: T) => ReactNode;
}) {
  if (error) return <ErrorState detail={error} />;
  if (!isLoading && !rows.length)
    return (
      <>
        {empty ?? (
          <EmptyState
            title="No items"
            description="There is nothing to show yet."
          />
        )}
      </>
    );
  return (
    <div className="tvx-data">
      <div className="tvx-data__wide">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={
                    c.sortable
                      ? sort?.id === c.id
                        ? sort.direction
                        : 'none'
                      : undefined
                  }
                >
                  {c.sortable ? (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        onSort?.({
                          id: c.id,
                          direction:
                            sort?.id === c.id && sort.direction === 'ascending'
                              ? 'descending'
                              : 'ascending',
                        })
                      }
                    >
                      {c.header}
                      <span aria-hidden>
                        {sort?.id === c.id
                          ? sort.direction === 'ascending'
                            ? ' ↑'
                            : ' ↓'
                          : ''}
                      </span>
                    </Button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {rowActions && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.id}>
                        <Skeleton />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={rowKey(r)}>
                    {columns.map((c) => (
                      <td key={c.id} data-align={c.align}>
                        {c.render?.(r) ?? c.accessor?.(r)}
                      </td>
                    ))}
                    {rowActions && <td>{rowActions(r)}</td>}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className="tvx-data__narrow" role="list" aria-label={caption}>
        {isLoading ? (
          <Skeleton />
        ) : (
          rows.map((r) => (
            <div role="listitem" key={rowKey(r)}>
              {renderNarrow(r)}
              {rowActions?.(r)}
            </div>
          ))
        )}
      </div>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
export function DescriptionList({
  items,
  variant = 'stacked',
}: {
  items: { term: ReactNode; description: ReactNode; action?: ReactNode }[];
  variant?: 'stacked' | 'horizontal';
}) {
  return (
    <dl className={`tvx-description tvx-description--${variant}`}>
      {items.map((i, n) => (
        <div key={n}>
          <dt>{i.term}</dt>
          <dd>{i.description}</dd>
          {i.action && <dd>{i.action}</dd>}
        </div>
      ))}
    </dl>
  );
}
export function List<T>({
  items,
  renderItem,
  ordered = false,
  variant = 'divided',
  empty,
  isLoading = false,
  error,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  ordered?: boolean;
  variant?: 'plain' | 'divided' | 'interactive';
  empty?: ReactNode;
  isLoading?: boolean;
  error?: string;
}) {
  if (error) return <ErrorState detail={error} />;
  if (isLoading)
    return (
      <ul className="tvx-list">
        <li>
          <Skeleton />
        </li>
      </ul>
    );
  if (!items.length)
    return (
      <>
        {empty ?? (
          <EmptyState
            title="No items"
            description="There is nothing to show."
          />
        )}
      </>
    );
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`tvx-list tvx-list--${variant}`}>
      {items.map((i, n) => (
        <li key={n}>{renderItem(i, n)}</li>
      ))}
    </Tag>
  );
}
