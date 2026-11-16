ALTER TABLE public.families
  ADD COLUMN street text,
  ADD COLUMN house_number text,
  ADD COLUMN postal_code text,
  ADD COLUMN city text,
  ADD COLUMN country text;

CREATE TABLE public.waste_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  waste_type text NOT NULL DEFAULT 'other' CHECK (waste_type IN ('general','recycling','organic','paper','bulky','seasonal','other')),
  label text NOT NULL,
  pickup_date date NOT NULL,
  provider text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ics_import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, waste_type, pickup_date)
);
CREATE INDEX waste_pickups_family_date_idx ON public.waste_pickups (family_id, pickup_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_pickups TO authenticated;
GRANT ALL ON public.waste_pickups TO service_role;
ALTER TABLE public.waste_pickups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family waste all" ON public.waste_pickups FOR ALL TO authenticated
  USING (family_id = public.current_family_id())
  WITH CHECK (family_id = public.current_family_id());