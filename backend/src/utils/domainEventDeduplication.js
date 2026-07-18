const value = (input) => String(input);
export const domainEventKey = (event, ...parts) => [event, ...parts.filter((part) => part !== undefined && part !== null).map(value)].join(':');
export const versionedEventKey = (event, id, version, prefix = 'v') => domainEventKey(event, id, `${prefix}${version}`);
