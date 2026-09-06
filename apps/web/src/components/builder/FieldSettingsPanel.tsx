"use client";

import { useEffect, useRef } from "react";
import { Copy, Plus, Trash2, Upload } from "lucide-react";
import type { FieldCondition, FieldDto, LookupDataset } from "@sfb/shared";
import { fieldSupportsOptions, isComputedField, isLayoutField, isPageBreak } from "@sfb/shared";
import { parseSimpleCsv } from "@/lib/simpleCsv";

interface Props {
  field: FieldDto | null;
  allFields: FieldDto[];
  onChange: (patch: Partial<FieldDto>) => void;
  selectedCount?: number;
  onBulkDuplicate?: () => void;
  onBulkDelete?: () => void;
  // LOOKUP fields autocomplete against one of the form's named reference
  // lists — these live on the form, not the field, so managing them goes
  // through the builder page rather than the field-level onChange above.
  // Debounced (typing a name/values doesn't save on every keystroke);
  // `Immediate` is used for creating/deleting a list, where the field's own
  // config.lookupDatasetId gets set in the same action and needs the new
  // list to already exist server-side-equivalent (in `form` state) first —
  // a debounced create would leave a brief window where the field points at
  // a dataset id that doesn't exist in `lookupDatasets` yet.
  lookupDatasets?: LookupDataset[];
  onLookupDatasetsChange?: (next: LookupDataset[]) => void;
  onLookupDatasetsChangeImmediate?: (next: LookupDataset[]) => Promise<boolean>;
}

const PLACEHOLDER_TYPES = new Set(["TEXT", "PARAGRAPH", "EMAIL", "PHONE", "NUMBER", "LOOKUP"]);
// Excluded from width choices: these either have complex internal
// sub-layouts that get cramped at half/third width (Address, Matrix,
// Repeater) or are true full-bleed content by nature (Signature, Divider,
// Page Break).
const WIDTH_UNSUPPORTED_TYPES = new Set(["ADDRESS", "MATRIX", "REPEATER", "SIGNATURE", "DIVIDER", "PAGE_BREAK", "SECTION"]);

export function FieldSettingsPanel({
  field,
  allFields,
  onChange,
  selectedCount = 0,
  onBulkDuplicate,
  onBulkDelete,
  lookupDatasets = [],
  onLookupDatasetsChange,
  onLookupDatasetsChangeImmediate,
}: Props) {
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
      f.type !== "MATRIX" &&
      f.type !== "REPEATER",
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

  // Answer piping reuses the same "earlier, value-bearing field" candidate
  // list as conditional logic — both need a field whose answer already
  // exists by the time this one is shown.
  function insertPipeToken(key: "label" | "helpText" | "htmlContent" | "richText", fieldId: string) {
    if (!field) return;
    const token = `{${fieldId}}`;
    if (key === "label") {
      onChange({ label: `${field.label}${token}` });
    } else {
      onChange({ config: { ...field.config, [key]: `${field.config[key] ?? ""}${token}` } });
    }
  }

  function renderPipeTokens(onInsert: (fieldId: string) => void) {
    if (conditionCandidates.length === 0) return null;
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400">Pipe in an earlier answer:</span>
        {conditionCandidates.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onInsert(f.id)}
            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            + {f.label}
          </button>
        ))}
      </div>
    );
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

  const repeaterColumns = field.config.repeaterColumns ?? [];

  function updateRepeaterColumn(id: string, label: string) {
    if (!field) return;
    onChange({
      config: {
        ...field.config,
        repeaterColumns: repeaterColumns.map((c) =>
          c.id === id ? { ...c, label, value: label.toLowerCase().replace(/\s+/g, "-") } : c,
        ),
      },
    });
  }

  function addRepeaterColumn() {
    if (!field) return;
    const n = repeaterColumns.length + 1;
    onChange({
      config: {
        ...field.config,
        repeaterColumns: [...repeaterColumns, { id: crypto.randomUUID(), label: `Column ${n}`, value: `column-${n}` }],
      },
    });
  }

  function removeRepeaterColumn(id: string) {
    if (!field) return;
    onChange({ config: { ...field.config, repeaterColumns: repeaterColumns.filter((c) => c.id !== id) } });
  }

  const selectedDataset =
    field.type === "LOOKUP" ? lookupDatasets.find((d) => d.id === field.config.lookupDatasetId) : undefined;

  // Editing a dataset's name and its values are two independent debounced
  // saves — each one has to build the *whole* lookupDatasets array to send.
  // Deriving that from the `lookupDatasets` prop directly is a real bug: the
  // prop only catches up ~700ms after a save round-trips, so a name edit
  // immediately followed by a values edit (both well within one debounce
  // window) would each build their array from the same stale, pre-edit
  // prop — and whichever save actually fires last would silently overwrite
  // the other's change. This ref is the always-current "what we've actually
  // asked to save" baseline, synced from props only when the selected field
  // changes (not on every prop update, or an in-flight edit's own eventual
  // server-confirmed echo would clobber a *newer* local edit the same way).
  const lookupDatasetsRef = useRef<LookupDataset[]>(lookupDatasets);
  useEffect(() => {
    lookupDatasetsRef.current = lookupDatasets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.id]);

  async function createLookupDataset() {
    if (!field || !onLookupDatasetsChangeImmediate) return;
    const newDataset: LookupDataset = { id: crypto.randomUUID(), name: `List ${lookupDatasetsRef.current.length + 1}`, values: [] };
    const next = [...lookupDatasetsRef.current, newDataset];
    const ok = await onLookupDatasetsChangeImmediate(next);
    if (ok) {
      lookupDatasetsRef.current = next;
      onChange({ config: { ...field.config, lookupDatasetId: newDataset.id } });
    }
  }

  function selectLookupDataset(id: string) {
    if (!field) return;
    if (id === "__new__") {
      createLookupDataset();
      return;
    }
    onChange({ config: { ...field.config, lookupDatasetId: id || undefined } });
  }

  function updateLookupDatasetName(id: string, name: string) {
    if (!onLookupDatasetsChange) return;
    const next = lookupDatasetsRef.current.map((d) => (d.id === id ? { ...d, name } : d));
    lookupDatasetsRef.current = next;
    onLookupDatasetsChange(next);
  }

  function updateLookupDatasetValues(id: string, values: string[]) {
    if (!onLookupDatasetsChange) return;
    const next = lookupDatasetsRef.current.map((d) => (d.id === id ? { ...d, values } : d));
    lookupDatasetsRef.current = next;
    onLookupDatasetsChange(next);
  }

  function deleteLookupDataset(id: string) {
    if (!field || !onLookupDatasetsChangeImmediate) return;
    const next = lookupDatasetsRef.current.filter((d) => d.id !== id);
    lookupDatasetsRef.current = next;
    onLookupDatasetsChangeImmediate(next);
    if (field.config.lookupDatasetId === id) {
      onChange({ config: { ...field.config, lookupDatasetId: undefined } });
    }
  }

  function handleLookupCsvUpload(id: string, file: File) {
    if (!onLookupDatasetsChangeImmediate) return;
    file.text().then((text) => {
      const values = parseSimpleCsv(text);
      const next = lookupDatasetsRef.current.map((d) => (d.id === id ? { ...d, values } : d));
      lookupDatasetsRef.current = next;
      onLookupDatasetsChangeImmediate(next);
    });
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
            {field.type === "HEADING"
              ? "Heading text"
              : field.type === "SECTION"
                ? "Section title"
                : isPageBreak(field.type)
                  ? "Next page title (optional)"
                  : "Label"}
          </label>
          <input
            className="input-field"
            value={field.label}
            placeholder={isPageBreak(field.type) ? "e.g. Shipping details" : undefined}
            onChange={(e) => onChange({ label: e.target.value })}
          />
          {renderPipeTokens((id) => insertPipeToken("label", id))}
        </div>
      )}

      {!WIDTH_UNSUPPORTED_TYPES.has(field.type) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Width</label>
          <select
            className="input-field"
            value={field.config.width ?? "full"}
            onChange={(e) => onChange({ config: { ...field.config, width: e.target.value as "full" | "half" | "third" } })}
          >
            <option value="full">Full width</option>
            <option value="half">Half width</option>
            <option value="third">Third width</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">Half/third-width fields sit side by side on the same row.</p>
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

      {(field.type === "TEXT" || field.type === "PARAGRAPH") && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Min length</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={field.config.minLength ?? ""}
                onChange={(e) =>
                  onChange({
                    config: { ...field.config, minLength: e.target.value === "" ? undefined : Number(e.target.value) },
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Max length</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={field.config.maxLength ?? ""}
                onChange={(e) =>
                  onChange({
                    config: { ...field.config, maxLength: e.target.value === "" ? undefined : Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
          {field.type === "TEXT" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Allowed characters</label>
              <select
                className="input-field"
                value={field.config.format ?? "any"}
                onChange={(e) => onChange({ config: { ...field.config, format: e.target.value as "any" | "letters" | "numbers" | "alphanumeric" } })}
              >
                <option value="any">Any</option>
                <option value="letters">Letters only</option>
                <option value="numbers">Numbers only</option>
                <option value="alphanumeric">Letters and numbers only</option>
              </select>
            </div>
          )}
        </div>
      )}

      {field.type === "NUMBER" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Min value</label>
            <input
              type="number"
              className="input-field"
              value={field.config.min ?? ""}
              onChange={(e) =>
                onChange({ config: { ...field.config, min: e.target.value === "" ? undefined : Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Max value</label>
            <input
              type="number"
              className="input-field"
              value={field.config.max ?? ""}
              onChange={(e) =>
                onChange({ config: { ...field.config, max: e.target.value === "" ? undefined : Number(e.target.value) } })
              }
            />
          </div>
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

      {field.type === "SECTION" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Description (optional)</label>
          <input
            className="input-field"
            value={field.config.helpText ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, helpText: e.target.value } })}
          />
          <p className="mt-1 text-xs text-slate-400">
            A condition set below hides this section's title and description along with every field in it, up to
            the next Section or Page Break — no need to repeat the same condition on each field individually.
          </p>
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
          {renderPipeTokens((id) => insertPipeToken("htmlContent", id))}
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
          {renderPipeTokens((id) => insertPipeToken("richText", id))}
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
          {renderPipeTokens((id) => insertPipeToken("helpText", id))}
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

      {!isLayoutField(field.type) && field.type !== "CALCULATION" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            URL parameter name (optional)
          </label>
          <input
            className="input-field"
            placeholder="e.g. ref"
            value={field.config.prefillKey ?? ""}
            onChange={(e) => onChange({ config: { ...field.config, prefillKey: e.target.value || undefined } })}
          />
          <p className="mt-1 text-xs text-slate-400">
            {field.config.prefillKey
              ? `Pre-fills from ?${field.config.prefillKey}=... in the public form's link.`
              : "Set a name to let the public link pre-fill this field via a query parameter."}
          </p>
        </div>
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

      {field.type === "REPEATER" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Columns</label>
          <div className="space-y-2">
            {repeaterColumns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <input
                  className="input-field flex-1"
                  value={col.label}
                  onChange={(e) => updateRepeaterColumn(col.id, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeRepeaterColumn(col.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  aria-label="Remove column"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRepeaterColumn} className="btn-secondary mt-2 w-full text-xs">
            <Plus size={14} /> Add column
          </button>
          <p className="mt-1 text-xs text-slate-400">Visitors add their own rows when filling out the form.</p>
        </div>
      )}

      {field.type === "LOOKUP" && (
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Reference list</label>
          <select
            className="input-field"
            value={field.config.lookupDatasetId ?? ""}
            onChange={(e) => selectLookupDataset(e.target.value)}
          >
            <option value="">No suggestions (plain text)</option>
            {lookupDatasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.values.length})
              </option>
            ))}
            <option value="__new__">+ New list...</option>
          </select>
          <p className="text-xs text-slate-400">
            Any Lookup field in this form can share the same list — no need to re-paste it for each one.
          </p>

          {selectedDataset && (
            // Keyed by the dataset's own content, not just its id: these
            // inputs are uncontrolled (defaultValue) so typing doesn't fight
            // the debounced-save round trip, same reasoning as the Title/
            // Product code fields above — but that means a change that
            // *doesn't* come from typing in this exact input (a CSV upload,
            // or the debounced save finally catching up) needs the key to
            // actually change too, or the stale defaultValue would never
            // re-take. Keying on the full content makes every such change a
            // remount (harmless when it just matches what's already shown).
            <div
              key={`${selectedDataset.id}:${selectedDataset.name}:${selectedDataset.values.join("\n")}`}
              className="space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50"
            >
              <input
                className="input-field text-sm"
                defaultValue={selectedDataset.name}
                onChange={(e) => updateLookupDatasetName(selectedDataset.id, e.target.value)}
                placeholder="List name"
              />
              <textarea
                className="input-field min-h-[100px] font-mono text-xs"
                defaultValue={selectedDataset.values.join("\n")}
                placeholder={"One value per line\ne.g.\nAcme Corp\nGlobex\nInitech"}
                onChange={(e) =>
                  updateLookupDatasetValues(
                    selectedDataset.id,
                    e.target.value
                      .split(/\r?\n/)
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
              <div className="flex items-center justify-between gap-2">
                <label className="btn-secondary cursor-pointer text-xs">
                  <Upload size={14} /> Upload .csv
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLookupCsvUpload(selectedDataset.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => deleteLookupDataset(selectedDataset.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Delete this list
                </button>
              </div>
            </div>
          )}
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
