import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Family = Tables<"families">;
export type Task = Tables<"tasks">;
export type Item = Tables<"items">;
export type ItemCategory = Tables<"item_categories">;
export type WastePickup = Tables<"waste_pickups">;
export type ExternalCalendar = Tables<"external_calendars">;
export type GoogleAccount = Tables<"google_accounts"> & { external_calendars: ExternalCalendar[] };

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: sess } = await supabase.auth.getSession();
    const auth = { user: sess.session?.user };
    if (!auth.user) throw new Error("Not signed in");
    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
    if (error) throw error;
    let family: Family | null = null;
    if (profile.family_id) {
      const { data } = await supabase.from("families").select("*").eq("id", profile.family_id).single();
      family = data;
    }
    return { profile, family, email: auth.user.email ?? "" };
  },
});

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").not("family_id", "is", null).order("created_at");
    if (error) throw error;
    return data;
  },
});

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  },
});

export const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: async () => {
    const { data, error } = await supabase.from("items").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const wastePickupsQuery = queryOptions({
  queryKey: ["waste_pickups"],
  queryFn: async () => {
    const { data, error } = await supabase.from("waste_pickups").select("*").order("pickup_date");
    if (error) throw error;
    return data;
  },
});

/** Connected Google accounts in the family, with the calendars chosen from each. */
export const googleAccountsQuery = queryOptions({
  queryKey: ["google_accounts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("google_accounts").select("*, external_calendars(*)").order("created_at");
    if (error) throw error;
    return data as GoogleAccount[];
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["item_categories"],
  staleTime: 1000 * 60 * 60,
  queryFn: async () => {
    const { data, error } = await supabase.from("item_categories").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const TASK_CATEGORIES = ["Household", "Garden", "Finance", "Kids", "Shopping", "Car", "Maintenance", "Admin"];
