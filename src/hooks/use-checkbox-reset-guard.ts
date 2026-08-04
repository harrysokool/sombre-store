"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a controlled checkbox showing the state it would submit.
 *
 * React resets the form element once a form action completes. That reset moves
 * the checkbox DOM without changing React state, so no re-render follows to
 * undo it and the box silently contradicts the value behind it — a toggle
 * switched off then saved would read as on again.
 *
 * Text and number inputs re-sync on their own; only the checked flag needs
 * this. Attach the returned ref to the input and pass the state driving it.
 */
export function useCheckboxResetGuard(checked: boolean) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.checked !== checked) {
      ref.current.checked = checked;
    }
  });

  return ref;
}
