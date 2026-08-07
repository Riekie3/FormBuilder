"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FieldDto } from "@sfb/shared";
import { fieldSupportsOptions, isLayoutField } from "@sfb/shared";

interface Props {
  field: FieldDto | null;
  allFields: FieldDto[];
  onChange: (patch: Partial<FieldDto>) => void;
}

const PLACEHOLDER_TYPES = new Set(["TEXT", "PARAGRAPH", "EMAIL", "PHONE", "NUMBER"]);

export function FieldSettingsPanel({ field, allFields, onChange }: Props) {
  if (!field) {
    return (
      <div className="card p-4 text-sm text-slate-400">Select a field to edit its settings.</div>
    );
  }

  const options = field.config.options ?? [];
  const numberFields = allFields.filter((f) => f.type === "NUMBER" && f.id !== field.id);

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

  function insertFormulaToken(fieldId: string) {
    if (!field) return;
    onChange({ config: { ...field.config, formula: `${field.config.formula ?? ""}{${fieldId}}` } });
  }

  return (
    <div className="card space-y-4 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Field settings</h3>

      {field.type !== "DIVIDER" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {field.type === "HEADING" ? "Heading text" : "Label"}
          </label>
          <input
            className="input-field"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
      )}

      {PLACEHOLDER_TYPES.has(field.type) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Placeholder</label>
          <input
            className="input-field"
            value={field.config.placeholder ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, placeholder: e.target.value } })}
          />
        </div>
      )}

      {field.type === "RATING" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Max rating</label>
          <input
            type="number"
            min={1}
            max={10}
            className="input-field"
            value={field.config.maxRating ?? 5}
            onChange={(e) => onChange({ config: { ...field.config, maxRating: Number(e.target.value) } })}
          />
        </div>
      )}

      {field.type === "HIDDEN" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Default value</label>
          <input
            className="input-field"
            value={field.config.defaultValue ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, defaultValue: e.target.value } })}
          />
          <p className="mt-1 text-xs text-slate-400">Submitted with every response, never shown to visitors.</p>
        </div>
      )}

      {field.type === "HTML_BLOCK" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">HTML content</label>
          <textarea
            className="input-field min-h-[120px] font-mono text-xs"
            value={field.config.htmlContent ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, htmlContent: e.target.value } })}
          />
          <p className="mt-1 text-xs text-slate-400">Sanitized before display — scripts and event handlers are stripped.</p>
        </div>
      )}

      {field.type === "RICH_TEXT" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Content</label>
          <textarea
            className="input-field min-h-[120px]"
            value={field.config.richText ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, richText: e.target.value } })}
          />
          <p className="mt-1 text-xs text-slate-400">
            Supports **bold**, _italic_, [link](https://...), and line breaks.
          </p>
        </div>
      )}

      {field.type === "CALCULATION" && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Formula</label>
            <textarea
              className="input-field min-h-[70px] font-mono text-xs"
              placeholder="{fieldId} + {fieldId} * 2"
              value={field.config.formula ?? ""}
              onChange={(e) => onChange({ config: { ...field.config, formula: e.target.value } })}
            />
          </div>
          {numberFields.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {numberFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => insertFormulaToken(f.id)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  + {f.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Add a Number field first, then insert it into the formula.</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Decimal places</label>
            <input
              type="number"
              min={0}
              max={6}
              className="input-field"
              value={field.config.precision ?? 2}
              onChange={(e) => onChange({ config: { ...field.config, precision: Number(e.target.value) } })}
            />
          </div>
        </div>
      )}

      {!isLayoutField(field.type) && field.type !== "CALCULATION" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Help text</label>
          <input
            className="input-field"
            value={field.config.helpText ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, helpText: e.target.value } })}
          />
        </div>
      )}

      {!isLayoutField(field.type) && field.type !== "CALCULATION" && field.type !== "HIDDEN" && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="h-4 w-4 rounded accent-brand-500"
          />
          Required field
        </label>
      )}

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
