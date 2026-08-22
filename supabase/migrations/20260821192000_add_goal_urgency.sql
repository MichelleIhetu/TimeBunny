ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'minor'
  CHECK (urgency IN ('minor', 'important'));
