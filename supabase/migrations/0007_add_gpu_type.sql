-- Add gpu_type column so the scheduler knows which Fireworks quota bucket
-- a job draws from. Default 'h200' covers all existing rows.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS gpu_type text NOT NULL DEFAULT 'h200';
