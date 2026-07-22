"use client";

import type { FieldDto } from "@sfb/shared";

interface Props {
  field: FieldDto;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

// Shared between the builder's live preview and the public form renderer so
// field behavior never drifts between "what you designed" and "what visitors see".
export function FormFieldRenderer({ field, value, onChange, error, disabled }: Props) {
  const baseLabel = (
    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const helpText = field.config.helpText && (
    <p className="mt-1 text-xs text-slate-400">{field.config.helpText}</p>
  );

  const errorText = error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>;

  const wrap = (control: React.ReactNode) => (
    <div>
      {baseLabel}
      {control}
      {helpText}
      {errorText}
    </div>
  );

  switch (field.type) {
    case "PARAGRAPH":
      return wrap(
        <textarea
          className="input-field min-h-[100px]"
          placeholder={field.config.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "DROPDOWN":
      return wrap(
        <select
          className="input-field"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select an option...</option>
          {field.config.options?.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>,
      );

    case "RADIO":
      return wrap(
        <div className="space-y-2">
          {field.config.options?.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 accent-brand-500"
              />
              {opt.label}
            </label>
          ))}
        </div>,
      );

    case "CHECKBOX": {
      const selected = new Set(value ? value.split(",") : []);
      return wrap(
        <div className="space-y-2">
          {field.config.options?.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  onChange([...next].join(","));
                }}
                className="h-4 w-4 rounded accent-brand-500"
              />
              {opt.label}
            </label>
          ))}
        </div>,
      );
    }

    case "NUMBER":
      return wrap(
        <input
          type="number"
          className="input-field"
          placeholder={field.config.placeholder}
          value={value}
          min={field.config.min}
          max={field.config.max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "DATE":
      return wrap(
        <input
          type="date"
          className="input-field"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "EMAIL":
      return wrap(
        <input
          type="email"
          className="input-field"
          placeholder={field.config.placeholder ?? "you@example.com"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "PHONE":
      return wrap(
        <input
          type="tel"
          className="input-field"
          placeholder={field.config.placeholder ?? "+1 555 123 4567"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "TEXT":
    default:
      return wrap(
        <input
          type="text"
          className="input-field"
          placeholder={field.config.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
  }
}
