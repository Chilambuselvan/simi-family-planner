import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Family = Tables<"families">;
export type Task = Tables<"tasks">;
export type Item = Tables<"items">;
export type ItemCategory = Tables<"item_categories">;

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
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
