"use client";

import { toast } from "sonner";

/**
 * Standard mutation result shape — matches existing server actions.
 */
export type ToastableResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message?: string };

export type UndoableOptions = {
  onUndo: () => void | Promise<void>;
  label?: string;
};

export type ToastOptions = {
  description?: string;
  duration?: number;
  undo?: UndoableOptions;
};

function toastWithUndo(
  type: "success" | "info",
  message: string,
  options: ToastOptions = {},
) {
  return toast[type](message, {
    description: options.description,
    duration: options.duration,
    action: options.undo
      ? {
          label: options.undo.label ?? "Undo",
          onClick: () => void options.undo!.onUndo(),
        }
      : undefined,
  });
}

export function toastSuccess(message: string, options: ToastOptions = {}) {
  return toastWithUndo("success", message, options);
}

export function toastInfo(message: string, options: ToastOptions = {}) {
  return toastWithUndo("info", message, options);
}

export function toastWarning(message: string, options: ToastOptions = {}) {
  return toast.warning(message, {
    description: options.description,
    duration: options.duration,
  });
}

export function toastError(message: string, options: ToastOptions = {}) {
  return toast.error(message, {
    description: options.description,
    duration: options.duration ?? 6000,
  });
}

/**
 * Drive a server-action promise through pending → success/error with consistent
 * copy. Returns the action's resolved value so callers can keep their existing
 * control flow.
 */
export async function toastPromise<T>(
  promise: Promise<T>,
  copy: {
    loading: string;
    success: string | ((value: T) => string);
    error?: string | ((err: unknown) => string);
  },
): Promise<T> {
  const id = toast.loading(copy.loading);
  try {
    const value = await promise;
    toast.success(
      typeof copy.success === "function" ? copy.success(value) : copy.success,
      { id },
    );
    return value;
  } catch (err) {
    const message =
      typeof copy.error === "function"
        ? copy.error(err)
        : (copy.error ?? "Something went wrong.");
    toast.error(message, { id });
    throw err;
  }
}

/**
 * Convenience for server actions that return `{ ok, message }`.
 *
 * Shows a loading toast → success/error based on the result, then returns the
 * result so the caller can branch on `ok`.
 */
export async function toastAction<T>(
  promise: Promise<ToastableResult<T>>,
  copy: {
    loading: string;
    success: string;
    error?: string;
  },
): Promise<ToastableResult<T>> {
  const id = toast.loading(copy.loading);
  try {
    const result = await promise;
    if (result.ok) {
      toast.success(result.message ?? copy.success, { id });
    } else {
      toast.error(result.message ?? copy.error ?? "Something went wrong.", { id });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : (copy.error ?? "Something went wrong.");
    toast.error(message, { id });
    return { ok: false, message };
  }
}
