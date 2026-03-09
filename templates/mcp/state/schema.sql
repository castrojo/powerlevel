CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rules (
    id          TEXT PRIMARY KEY,
    domain      TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT[] DEFAULT '{}',
    search_vec  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rules_search_idx ON rules USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS rules_domain_idx ON rules (domain);

CREATE TABLE IF NOT EXISTS skill_sections (
    skill       TEXT NOT NULL,
    section     TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT[] DEFAULT '{}',
    search_vec  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (skill, section)
);
CREATE INDEX IF NOT EXISTS skill_sections_search_idx ON skill_sections USING GIN (search_vec);

CREATE TABLE IF NOT EXISTS plan_tasks (
    repo        TEXT NOT NULL,
    plan_id     TEXT NOT NULL,
    task_num    INTEGER NOT NULL,
    description TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    claimed_by  TEXT,
    claimed_at  TIMESTAMPTZ,
    notes       TEXT,
    PRIMARY KEY (repo, plan_id, task_num)
);
CREATE INDEX IF NOT EXISTS plan_tasks_status_idx ON plan_tasks (repo, plan_id, status);

CREATE TABLE IF NOT EXISTS loop_state (
    repo        TEXT PRIMARY KEY,
    phase       TEXT NOT NULL DEFAULT '',
    run         TEXT NOT NULL DEFAULT '',
    goal        TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo        TEXT NOT NULL,
    plan_id     TEXT,
    phase       TEXT,
    run_num     INTEGER,
    summary     TEXT,
    findings    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS run_history_repo_idx ON run_history (repo, created_at DESC);
