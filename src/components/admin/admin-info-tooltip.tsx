"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type AdminInfoTooltipProps = {
  /** Accessible name for the trigger, e.g. "More information about Prefix". */
  label: string;
  children: ReactNode;
};

/**
 * A small "i" icon that reveals a short explanation beside a field label.
 *
 * Visibility is the union of three independent reasons: hover, keyboard
 * focus, and an explicit click "pin". Click only ever toggles the pin — never
 * a plain toggle of the combined visibility — because a real mouse click
 * always fires a hover (and usually a focus) event on the same target just
 * before the click event itself, so by the time a click handler runs, the
 * icon already looks "open" for reasons unrelated to the click. Toggling the
 * combined state from inside the click handler would then immediately
 * re-close a tooltip the same click just opened. Unpinning explicitly clears
 * hover and focus too, so a second click closes it even while the pointer is
 * still resting on the icon; a genuinely new mouseenter or focus afterwards
 * reopens it as normal.
 */
export function AdminInfoTooltip({ label, children }: AdminInfoTooltipProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  function closeAll() {
    setHovered(false);
    setFocused(false);
    setPinned(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAll();
      }
    }

    function handleOutsidePress(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        closeAll();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsidePress);
    document.addEventListener("touchstart", handleOutsidePress);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsidePress);
      document.removeEventListener("touchstart", handleOutsidePress);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() =>
          setPinned((currentlyPinned) => {
            const nextPinned = !currentlyPinned;

            if (!nextPinned) {
              // An explicit close should win even if the pointer never left.
              setHovered(false);
              setFocused(false);
            }

            return nextPinned;
          })
        }
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-stone-400 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        data-state={open ? "open" : "closed"}
        className={`absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-white/10 bg-[#1c1a18] px-3 py-2 text-xs leading-5 text-stone-300 shadow-lg shadow-black/40 transition-opacity duration-100 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
