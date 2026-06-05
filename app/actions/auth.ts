"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authCallbackRedirectUrl, getSiteOrigin } from "@/lib/get-site-origin";
import { mustChangePassword } from "@/lib/must-change-password";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard");
  if (mustChangePassword(data.user?.user_metadata ?? {})) {
    redirect("/login/set-password");
  }
  redirect("/dashboard");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login/forgot-password?error=Email%20is%20required");
  }

  const origin = await getSiteOrigin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackRedirectUrl(origin),
  });

  if (error) {
    redirect(`/login/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    redirect("/login/reset-password?error=Password%20is%20required");
  }
  if (password.length < 8) {
    redirect("/login/reset-password?error=Password%20must%20be%20at%20least%208%20characters");
  }
  if (password !== confirmPassword) {
    redirect("/login/reset-password?error=Passwords%20do%20not%20match");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  });

  if (error) {
    redirect(`/login/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  revalidatePath("/dashboard");
  redirect("/login?reset=1");
}

export async function completeRequiredPasswordChange(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    redirect("/login/set-password?error=Password%20is%20required");
  }
  if (password.length < 8) {
    redirect(
      "/login/set-password?error=Password%20must%20be%20at%20least%208%20characters",
    );
  }
  if (password !== confirmPassword) {
    redirect("/login/set-password?error=Passwords%20do%20not%20match");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    redirect("/login?error=Session%20expired.%20Please%20sign%20in%20again.");
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  });

  if (error) {
    redirect(`/login/set-password?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
