import {
  formatStatusLabel,
  getStatusTone,
  STATUS_TONE_CLASSES,
  type StatusKind,
} from "@/lib/admin/status-tone";

type StatusBadgeProps = {
  kind: StatusKind;
  value: string;
  // Rendered instead of the formatted status word when a surface already has a
  // label for the value (the fulfilment panel, for example).
  label?: string;
  ariaLabel?: string;
};

/**
 * One status value, as a readable word plus a tone. The word is always present,
 * so the badge never depends on colour alone. `data-tone` exposes the mapping
 * for tests without pinning them to Tailwind class strings.
 */
export function StatusBadge({
  kind,
  value,
  label,
  ariaLabel,
}: StatusBadgeProps) {
  const tone = getStatusTone(kind, value);

  return (
    <span
      aria-label={ariaLabel}
      data-tone={tone}
      className={`inline-flex w-fit max-w-full items-center whitespace-normal break-words rounded-full border px-3 py-1 text-xs leading-5 tracking-[0.08em] [overflow-wrap:anywhere] ${STATUS_TONE_CLASSES[tone]}`}
    >
      {label ?? formatStatusLabel(value)}
    </span>
  );
}
