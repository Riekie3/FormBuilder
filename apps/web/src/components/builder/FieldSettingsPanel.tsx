"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import type { FieldCondition, FieldDto } from "@sfb/shared";
import { fieldSupportsOptions, isComputedField, isLayoutField, isPageBreak } from "@sfb/shared";

interface Props {
  field: FieldDto | null;
  allFields: FieldDto[];
  onChange: (patch: Partial<FieldDto>) => void;
  selectedCount?: number;
  onBulkDuplicate?: () => void;
  onBulkDelete?: () => void;
}

const PLACEHOLDER_TYPES = new Set(["TEXT", "PARAGRAPH", "EMAIL", "PHONE", "NUMBER"]);

export function FieldSettingsPanel({ field, allFields, onChange, selectedCount = 0, onBulkDuplicate, onBulkDelete }: Props) {
  if (selectedCount > 1) {
    return (
      <div className="card space-y-3 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{selectedCount} fields selected</h3>
        <div className="flex gap-2">
          <button type="button" onClick={onBulkDuplicate} className="btn-secondary flex-1 text-xs">
            <Copy size={14} /> Duplicate
          </button>
          <button
            type="button"
            onClick={onBulkDelete}
            className="btn-secondary flex-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Ctrl/Cmd-click to add or remove a field, Shift-click to select a range. Ctrl/Cmd+C then Ctrl/Cmd+V to copy.
        </p>
      </div>
    );
  }

  if (!field) {
    return (
      <div className="card p-4 text-sm text-slate-400">Select a field to edit its settings.</div>
    );
  }

  const options = field.config.options ?? [];
  const numberFields = allFields.filter((f) => f.type === "NUMBER" && f.id !== field.id);
  // Only fields earlier in the form can be a condition's trigger — a field
  // can't meaningfully depend on an answer the visitor hasn't given yet.
  const conditionCandidates = allFields.filter(
    (f) =>
      f.id !== field.id &&
      f.order < field.order &&
      !isLayoutField(f.type) &&
      !isComputedField(f.type) &&
      f.type !== "MATRIX",
  );
  const condition = field.config.conditions?.[0];
  const conditionTarget = condition ? allFields.find((f) => f.id === condition.fieldId) : undefined;

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

  const matrixRows = field.config.matrixRows ?? [];
  const matrixColumns = field.config.matrixColumns ?? [];

  function updateMatrixRow(id: string, label: string) {
    if (!field) return;
    onChange({ config: { ...field.config, matrixRows: matrixRows.map((r) => (r.id === id ? { ...r, label } : r)) } });
  }

  function addMatrixRow() {
    if (!field) return;
    const n = matrixRows.length + 1;
    onChange({
      config: { ...field.config, matrixRows: [...matrixRows, { id: crypto.randomUUID(), label: `Row ${n}`, value: `row-${n}` }] },
    });
  }

  function removeMatrixRow(id: string) {
    if (!field) return;
    onChange({ config: { ...field.config, matrixRows: matrixRows.filter((r) => r.id !== id) } });
  }

  function updateMatrixColumn(id: string, label: string) {
    if (!field) return;
    onChange({
      config: {
        ...field.config,
        matrixColumns: matrixColumns.map((c) =>
          c.id === id ? { ...c, label, value: label.toLowerCase().replace(/\s+/g, "-") } : c,
        ),
      },
    });
  }

  function addMatrixColumn() {
    if (!field) return;
    const n = matrixColumns.length + 1;
    onChange({
      config: {
        ...field.config,
        matrixColumns: [...matrixColumns, { id: crypto.randomUUID(), label: `Column ${n}`, value: `column-${n}` }],
      },
    });
  }

  function removeMatrixColumn(id: string) {
    if (!field) return;
    onChange({ config: { ...field.config, matrixColumns: matrixColumns.filter((c) => c.id !== id) } });
  }

  function toggleCondition(enabled: boolean) {
    if (!field) return;
    if (!enabled) {
      const { conditions: _conditions, ...rest } = field.config;
      onChange({ config: rest });
      return;
    }
    const target = conditionCandidates[0];
    if (!target) return;
    const initial: FieldCondition = {
      fieldId: target.id,
      operator: "equals",
      value: target.config.options?.[0]?.value ?? "",
    };
    onChange({ config: { ...field.config, conditions: [initial] } });
  }

  function updateCondition(patch: Partial<FieldCondition>) {
    if (!field || !condition) return;
    onChange({ config: { ...field.config, conditions: [{ ...condition, ...patch }] } });
  }

  return (
    <div className="card space-y-4 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Field settings</h3>

      {field.type !== "DIVIDER" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {field.type === "HEADING" ? "Heading text" : isPageBreak(field.type) ? "Next page title (optional)" : "Label"}
          </label>
          <input
            className="input-field"
            value={field.label}
            placeholder={isPageBreak(field.type) ? "e.g. Shipping details" : undefined}
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

      {field.type === "MATRIX" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Rows</label>
            <div className="space-y-2">
              {matrixRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    className="input-field flex-1"
                    value={row.label}
                    onChange={(e) => updateMatrixRow(row.id, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeMatrixRow(row.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    aria-label="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addMatrixRow} className="btn-secondary mt-2 w-full text-xs">
              <Plus size={14} /> Add row
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Columns</label>
            <div className="space-y-2">
              {matrixColumns.map((col) => (
                <div key={col.id} className="flex items-center gap-2">
                  <input
                    className="input-field flex-1"
                    value={col.label}
                    onChange={(e) => updateMatrixColumn(col.id, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeMatrixColumn(col.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    aria-label="Remove column"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addMatrixColumn} className="btn-secondary mt-2 w-full text-xs">
              <Plus size={14} /> Add column
            </button>
          </div>
        </div>
      )}

      {!isPageBreak(field.type) && (
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!condition}
              disabled={!condition && conditionCandidates.length === 0}
              onChange={(e) => toggleCondition(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-500"
            />
            Only show when a condition is met
          </label>

          {!condition && conditionCandidates.length === 0 && (
            <p className="text-xs text-slate-400">Add an earlier field first to condition this one on it.</p>
          )}

          {condition && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <select
                className="input-field"
                value={condition.fieldId}
                onChange={(e) => updateCondition({ fieldId: e.target.value, value: "" })}
              >
                {conditionCandidates.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="input-field"
                value={condition.operator}
                onChange={(e) => updateCondition({ operator: e.target.value as FieldCondition["operator"] })}
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Does not equal</option>
                <option value="contains">Contains</option>
              </select>
              {conditionTarget?.config.options?.length ? (
                <select
                  className="input-field"
                  value={condition.value}
                  onChange={(e) => updateCondition({ value: e.target.value })}
                >
                  <option value="">Select a value...</option>
                  {conditionTarget.config.options.map((o) => (
                    <option key={o.id} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input-field"
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateCondition({ value: e.target.value })}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
