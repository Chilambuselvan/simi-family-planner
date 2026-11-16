DROP POLICY IF EXISTS "read categories" ON public.item_categories;
CREATE POLICY "family members read categories" ON public.item_categories FOR SELECT TO authenticated
  USING (public.current_family_id() IS NOT NULL);