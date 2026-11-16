CREATE TABLE public.google_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  google_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, google_email)
);
GRANT SELECT, DELETE ON public.google_accounts TO authenticated;
GRANT ALL ON public.google_accounts TO service_role;
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family sees google accounts" ON public.google_accounts FOR SELECT TO authenticated
  USING (family_id = public.current_family_id());
CREATE POLICY "owner deletes google account" ON public.google_accounts FOR DELETE TO authenticated
  USING (family_id = public.current_family_id() AND user_id = auth.uid());

CREATE TABLE public.google_account_tokens (
  google_account_id uuid PRIMARY KEY REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.google_account_tokens FROM anon, authenticated;
GRANT ALL ON public.google_account_tokens TO service_role;
ALTER TABLE public.google_account_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.external_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  google_account_id uuid NOT NULL REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4285F4',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (google_account_id, google_calendar_id)
);
CREATE INDEX external_calendars_family_id_idx ON public.external_calendars (family_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_calendars TO authenticated;
GRANT ALL ON public.external_calendars TO service_role;
ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family reads calendars" ON public.external_calendars FOR SELECT TO authenticated
  USING (family_id = public.current_family_id());
CREATE POLICY "family adds calendars" ON public.external_calendars FOR INSERT TO authenticated
  WITH CHECK (family_id = public.current_family_id() AND EXISTS (
    SELECT 1 FROM public.google_accounts ga WHERE ga.id = google_account_id AND ga.family_id = public.current_family_id()));
CREATE POLICY "family updates calendars" ON public.external_calendars FOR UPDATE TO authenticated
  USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());
CREATE POLICY "family deletes calendars" ON public.external_calendars FOR DELETE TO authenticated
  USING (family_id = public.current_family_id());