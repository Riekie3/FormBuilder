"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FieldDto } from "@sfb/shared";
import { fieldSupportsOptions } from "@sfb/shared";

interface Props {
  field: FieldDto | null;
  onChange: (patch: Partial<FieldDto>) => void;
}

export function FieldSettingsPanel({ field, onChange }: Props) {
  if (!field) {
    return (
      <div className="card p-4 text-sm text-slate-400">Select a field to edit its settings.</div>
    );
  }

  const options = field.config.options ?? [];

  function updateOption(id: string, patch: Partial<{ label: string; value: string }>) {
    if (!field) return;
    onChange({
      config: {
        ...field.config,
        options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      },
    });
  }

  function addOption() {
    if (!field) return;
    const n = options.length + 1;
    onChange({
      config: {
        ...field.config,
        options: [...options, { id: crypto.randomUUID(), label: `Option ${n}`, value: `option-${n}` }],
      },
    });
  }

  function removeOption(id: string) {
    if (!field) return;
    onChange({ config: { ...field.config, options: options.filter((o) => o.id !== id) } });
  }

  return (
    <div className="card space-y-4 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Field settings</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Label</label>
        <input
          className="input-field"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>

      {(field.type === "TEXT" || field.type === "PARAGRAPH" || field.type === "EMAIL" || field.type === "PHONE" || field.type === "NUMBER") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Placeholder</label>
          <input
            className="input-field"
            value={field.config.placeholder ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, placeholder: e.target.value } })}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Help text</label>
        <input
          className="input-field"
          value={field.config.helpText ?? ""}
          onChange={(e) => onChange({ config: { ...field.config, helpText: e.target.value } })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 rounded accent-brand-500"
        />
        Required field
      </label>

      {fieldSupportsOptions(field.type) && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Options</label>
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <input
                  className="input-field flex-1"
                  value={opt.label}
                  onChange={(e) => updateOption(opt.id, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                />
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  aria-label="Remove option"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addOption} className="btn-secondary mt-2 w-full text-xs">
            <Plus size={14} /> Add option
          </button>
        </div>
      )}
    </div>
  );
}
