"use client";

import * as React from "react";

export type KeyboardShortcutOptions = {
  meta?: boolean;
  ctrl?: boolean;
  /** Cmd on macOS or Ctrl on Windows/Linux (palette-style shortcuts). */
  metaOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
  allowInInput?: boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

export function useKeyboardShortcut(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
) {
  const {
    meta = false,
    ctrl = false,
    metaOrCtrl = false,
    shift = false,
    alt = false,
    enabled = true,
    preventDefault = true,
    allowInInput = false,
  } = options;

  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!allowInInput && isTypingTarget(event.target)) {
        return;
      }

      if (typeof event.key !== "string" || !key) {
        return;
      }

      const keyMatch = event.key.toLowerCase() === key.toLowerCase();
      if (!keyMatch) {
        return;
      }

      if (metaOrCtrl && !event.metaKey && !event.ctrlKey) {
        return;
      }
      if (meta && !event.metaKey) {
        return;
      }
      if (ctrl && !event.ctrlKey) {
        return;
      }
      if (shift && !event.shiftKey) {
        return;
      }
      if (alt && !event.altKey) {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }
      callbackRef.current(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, meta, ctrl, metaOrCtrl, shift, alt, enabled, preventDefault, allowInInput]);
}
