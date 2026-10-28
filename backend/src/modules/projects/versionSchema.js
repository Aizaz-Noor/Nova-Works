// Additive full-record revisions for ERP project/task compare-and-swap updates.
export const projectTaskVersionSql = `
ALTER TABLE platform_projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0);
ALTER TABLE platform_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0);
`;

export const projectTaskVersionPostgresSql = projectTaskVersionSql
 .replaceAll('platform_projects', 'novaworks.platform_projects')
 .replaceAll('platform_tasks', 'novaworks.platform_tasks');
