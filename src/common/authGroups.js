// Exact group-name checks, kept free of UI imports so the Node unit tests can load them.
export const hasAuthGroup = (user, groupName) => Boolean(user?.auth_groups?.includes(groupName));
