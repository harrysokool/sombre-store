"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a controlled `<select>` showing the option it would submit.
 *
 * React resets the form element once a form action completes. That reset moves
 * the select's DOM value without changing React state, so no re-render follows
 * to undo it and the control silently contradicts the value behind it — after a
 * refused save, a chosen option reads as nothing chosen while the state still
 * holds the choice.
 *
 * Text and number inputs re-sync on their own, so only selects and checkboxes
 * need this; see `useCheckboxResetGuard` for the checked-flag equivalent.
 * Attach the returned ref to the select and pass the state driving it.
 */
export function useSelectResetGuard(value: string) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.value !== value) {
      ref.current.value = value;
    }
  });

  return ref;
}
