const DEFAULT_SCROLL_ROOT = "[data-dashboard-scroll]";

/**
 * Scrolls a form field anchor into view inside the dashboard scroll column and
 * focuses the first focusable control within it.
 */
export function scrollFieldIntoView(
  fieldId: string,
  scrollRootSelector = DEFAULT_SCROLL_ROOT,
): void {
  if (!fieldId) {
    return;
  }

  const scrollRoot = document.querySelector(scrollRootSelector);
  const el = document.querySelector(`[data-pr-field="${fieldId}"]`);
  if (!el || !(el instanceof HTMLElement)) {
    return;
  }

  if (scrollRoot instanceof HTMLElement) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset =
      elRect.top -
      rootRect.top -
      rootRect.height / 2 +
      elRect.height / 2;
    scrollRoot.scrollBy({ top: offset, behavior: "smooth" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  requestAnimationFrame(() => {
    const focusable = el.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  });
}
