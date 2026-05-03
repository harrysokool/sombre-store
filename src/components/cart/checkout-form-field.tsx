type CheckoutFormFieldProps = {
  label: string;
  name: string;
  type: "email" | "tel" | "text";
  placeholder: string;
  required?: boolean;
  className?: string;
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-stone-100 outline-none transition-colors placeholder:text-stone-600 focus:border-white/20";

export function CheckoutFormField({
  label,
  name,
  type,
  placeholder,
  required = false,
  className = "space-y-2",
}: CheckoutFormFieldProps) {
  return (
    <label className={className}>
      <span className="text-xs uppercase tracking-[0.24em] text-stone-500">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        className={inputClassName}
        placeholder={placeholder}
      />
    </label>
  );
}
