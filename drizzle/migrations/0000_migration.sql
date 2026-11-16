
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT 'Family member',
  avatar_color text NOT NULL DEFAULT 'sage',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_family_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "see own family" ON public.families FOR SELECT TO authenticated USING (id = public.current_family_id());
CREATE POLICY "update own family" ON public.families FOR UPDATE TO authenticated USING (id = public.current_family_id());

CREATE POLICY "see self and family" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (family_id IS NOT NULL AND family_id = public.current_family_id()));
CREATE POLICY "update self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND family_id IS NOT DISTINCT FROM public.current_family_id());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_family(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.families (name, created_by) VALUES (_name, auth.uid()) RETURNING id INTO fid;
  UPDATE public.profiles SET family_id = fid WHERE id = auth.uid();
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.join_family(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id INTO fid FROM public.families WHERE invite_code = upper(trim(_code));
  IF fid IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  UPDATE public.profiles SET family_id = fid WHERE id = auth.uid();
  RETURN fid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_family(text), public.join_family(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_family(text), public.join_family(text), public.current_family_id() TO authenticated;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  category text,
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family tasks all" ON public.tasks FOR ALL TO authenticated
  USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());

CREATE TABLE public.item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'box',
  sort_order int NOT NULL DEFAULT 100
);
GRANT SELECT ON public.item_categories TO authenticated;
GRANT ALL ON public.item_categories TO service_role;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read categories" ON public.item_categories FOR SELECT TO authenticated USING (true);
INSERT INTO public.item_categories (name, icon, sort_order) VALUES
  ('Solar / PV system','sun',1),('Heat pump','thermometer',2),('EV charger','plug',3),
  ('Appliance','refrigerator',4),('Utility system','wrench',5),('Vehicle','car',6),
  ('Furniture','sofa',7),('Electronics','tv',8),('Other','box',99);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  purchase_date date,
  warranty_expiry date,
  location text,
  maintenance_interval_months int CHECK (maintenance_interval_months IS NULL OR maintenance_interval_months > 0),
  last_serviced date,
  notes text,
  photo_path text,
  contact_name text,
  contact_phone text,
  contact_email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family items all" ON public.items FOR ALL TO authenticated
  USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());

CREATE INDEX ON public.tasks(family_id, due_date);
CREATE INDEX ON public.items(family_id);
