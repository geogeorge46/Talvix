/** Builds stable pagination metadata. */
export const buildPagination = (page, limit, total) => {
  const pages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, pages, hasNextPage: page < pages, hasPreviousPage: page > 1 && pages > 0 };
};

/** Escapes user input before constructing a bounded regular expression. */
export const createSafeRegex = (value) =>
  new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
