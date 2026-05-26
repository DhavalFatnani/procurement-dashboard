"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { MutationResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase";

async function getSiteOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function revalidateProfileSurfaces() {
  revalidatePath("/profile");
  revalidatePath("/", "layout");
}

export async function updateProfileName(name: string): Promise<MutationResult> {
  const user = await getRequestSession();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Name is required." };
  }
  if (trimmed.length > 120) {
    return { ok: false, message: "Name must be 120 characters or fewer." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    data: { name: trimmed },
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: trimmed },
  });

  revalidateProfileSurfaces();
  return { ok: true };
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<MutationResult> {
  const user = await getRequestSession();
  if (!user?.email) {
    return { ok: false, message: "Not signed in." };
  }

  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword) {
    return { ok: false, message: "Current password is required." };
  }
  if (!newPassword) {
    return { ok: false, message: "New password is required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New passwords do not match." };
  }
  if (newPassword === currentPassword) {
    return { ok: false, message: "Choose a password different from your current one." };
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Password updated." };
}

export async function sendOwnPasswordResetEmail(): Promise<MutationResult> {
  const user = await getRequestSession();
  if (!user?.email) {
    return { ok: false, message: "Not signed in." };
  }

  const origin = await getSiteOrigin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/callback?next=/login/reset-password`,
  });
  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: `Password reset link sent to ${user.email}.`,
  };
}
