CREATE OR REPLACE FUNCTION public.owns_google_account(_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.google_accounts ga
    WHERE ga.id = _account_id AND ga.user_id = auth.uid() AND ga.family_id = public.current_family_id())
$$;
REVOKE EXECUTE ON FUNCTION public.owns_google_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_google_account(uuid) TO authenticated;

DROP POLICY IF EXISTS "family adds calendars" ON public.external_calendars;
DROP POLICY IF EXISTS "family updates calendars" ON public.external_calendars;
DROP POLICY IF EXISTS "family deletes calendars" ON public.external_calendars;

CREATE POLICY "owner adds calendars" ON public.external_calendars FOR INSERT TO authenticated
  WITH CHECK (family_id = public.current_family_id() AND public.owns_google_account(google_account_id));
CREATE POLICY "owner updates calendars" ON public.external_calendars FOR UPDATE TO authenticated
  USING (family_id = public.current_family_id() AND public.owns_google_account(google_account_id))
  WITH CHECK (family_id = public.current_family_id() AND public.owns_google_account(google_account_id));
CREATE POLICY "owner deletes calendars" ON public.external_calendars FOR DELETE TO authenticated
  USING (family_id = public.current_family_id() AND public.owns_google_account(google_account_id));