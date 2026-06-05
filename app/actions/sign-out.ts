"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

/** Isolated so auth.ts edits do not invalidate the logout action id in the shell. */
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/login");
}
