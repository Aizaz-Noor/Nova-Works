export const schema = `
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','MANAGER','AGENT')),
 specialization TEXT NOT NULL, skills TEXT NOT NULL CHECK(json_valid(skills))
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, client_name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', manager_id TEXT NOT NULL REFERENCES users(id),
 deadline TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 assignee_id TEXT NOT NULL REFERENCES users(id), deadline TEXT NOT NULL,
 estimated_hours REAL NOT NULL CHECK(estimated_hours > 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assignee ON tasks(assignee_id);
CREATE TABLE IF NOT EXISTS transcript_submissions (
 hash TEXT PRIMARY KEY, result_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS project_manager_role BEFORE INSERT ON projects
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id = NEW.manager_id AND role = 'MANAGER')
BEGIN SELECT RAISE(ABORT, 'Project manager must be a MANAGER'); END;
CREATE TRIGGER IF NOT EXISTS task_assignee_role BEFORE INSERT ON tasks
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id = NEW.assignee_id AND role = 'AGENT')
BEGIN SELECT RAISE(ABORT, 'Task assignee must be an AGENT'); END;
CREATE TRIGGER IF NOT EXISTS task_deadline BEFORE INSERT ON tasks
WHEN NEW.deadline > (SELECT deadline FROM projects WHERE id = NEW.project_id)
BEGIN SELECT RAISE(ABORT, 'Task deadline exceeds project deadline'); END;
`;
