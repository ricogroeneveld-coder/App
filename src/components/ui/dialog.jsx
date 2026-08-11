import React, { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reusable accessible modal primitive. Render it (conditionally, or inside an
// <AnimatePresence>) only while the dialog should be open — it renders nothing
// on its own when unmounted, so the caller owns open/close state and the exit
// animation runs on unmount. While mounted it:
//   • renders a full-screen backdrop + a panel
//   • sets role="dialog" + aria-modal="true" + aria-labelledby / aria-label
//   • moves focus into the panel on open and traps Tab within it
//   • restores focus to the previously-focused element on close
//   • closes on Escape and (optionally) on backdrop click
//   • locks background scroll while open
// framer-motion enter/exit respects the app-global MotionConfig
// reducedMotion="user" — no extra config needed here.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function Dialog({
  onClose = undefined,
  title = undefined,
  titleId = undefined,
  placement = "center",
  dismissOnBackdrop = true,
  panelClassName = undefined,
  className = undefined,
  children = undefined,
  ...props
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Focus management + scroll lock. Runs once for the dialog's lifetime; the
  // cleanup restores both when the caller unmounts it.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusables = getFocusable(panel);
    if (focusables.length) focusables[0].focus();
    else if (panel) panel.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      const el = previouslyFocused.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      const focusables = getFocusable(panel);
      if (!focusables.length) {
        // Nothing to focus — keep focus pinned to the panel.
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // 'bottom' → bottom-sheet on phones, centered on larger screens (matches the
  // app's existing modal look); 'center' → always centered.
  const placementClass =
    placement === "bottom" ? "items-end sm:items-center" : "items-center";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={dismissOnBackdrop ? () => onClose?.() : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "fixed inset-0 z-50 flex justify-center p-4 bg-black/60 backdrop-blur-sm",
        placementClass,
        className
      )}
    >
      <motion.div
        {...props}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId || undefined}
        aria-label={
          !titleId && typeof title === "string" ? title : undefined
        }
        tabIndex={-1}
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full max-w-md outline-none", panelClassName)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default Dialog;
