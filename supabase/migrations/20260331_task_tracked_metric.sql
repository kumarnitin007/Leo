-- Add tracked_metric JSONB column to myday_tasks
-- Enables "Tracked Tasks" that auto-complete based on fitness/integration data
-- e.g. { "type": "steps", "target": 10000, "unit": "steps", "autoComplete": true }

alter table myday_tasks
  add column if not exists tracked_metric jsonb default null;

comment on column myday_tasks.tracked_metric is
  'Optional: auto-complete config. JSON: { type, target, unit, autoComplete }';
