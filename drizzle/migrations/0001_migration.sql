
CREATE POLICY "family photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = public.current_family_id()::text);
CREATE POLICY "family photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = public.current_family_id()::text);
CREATE POLICY "family photos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = public.current_family_id()::text);
CREATE POLICY "family photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = public.current_family_id()::text);
