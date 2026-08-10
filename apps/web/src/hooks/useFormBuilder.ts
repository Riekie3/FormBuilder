"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldDto, FieldOption, FieldType, FormDetailDto } from "@sfb/shared";
import { fieldSupportsOptions, FIELD_TYPE_LABELS } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SelectModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const HISTORY_LIMIT = 50;

function tempId() {
  return `tmp-${crypto.randomUUID()}`;
}

function cloneField(f: FieldDto, overrides: Partial<FieldDto> = {}): FieldDto {
  return {
    ...f,
    id: tempId(),
    config: {
      ...f.config,
      options: f.config.options?.map((o) => ({ ...o })),
      matrixRows: f.config.matrixRows?.map((r) => ({ ...r })),
      matrixColumns: f.config.matrixColumns?.map((c) => ({ ...c })),
    },
    ...overrides,
  };
}

function defaultConfigFor(type: FieldType) {
  if (fieldSupportsOptions(type)) {
    const options: FieldOption[] = [
      { id: crypto.randomUUID(), label: "Option 1", value: "option-1" },
      { id: crypto.randomUUID(), label: "Option 2", value: "option-2" },
    ];
    return { options };
  }
  if (type === "RATING") return { maxRating: 5 };
  if (type === "CALCULATION") return { formula: "", precision: 2 };
  if (type === "HTML_BLOCK") return { htmlContent: "" };
  if (type === "RICH_TEXT") return { richText: "" };
  if (type === "MATRIX") {
    const matrixRows: FieldOption[] = [
      { id: crypto.randomUUID(), label: "Row 1", value: "row-1" },
      { id: crypto.randomUUID(), label: "Row 2", value: "row-2" },
      { id: crypto.randomUUID(), label: "Row 3", value: "row-3" },
    ];
    const matrixColumns: FieldOption[] = [
      { id: crypto.randomUUID(), label: "Poor", value: "poor" },
      { id: crypto.randomUUID(), label: "Fair", value: "fair" },
      { id: crypto.randomUUID(), label: "Good", value: "good" },
    ];
    return { matrixRows, matrixColumns };
  }
  return {};
}

export function useFormBuilder(formId: string) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<FormDetailDto | null>(null);
  const [fields, setFields] = useState<FieldDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorIndexRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);
  // Only real user edits (via the mutators below) should trigger an autosave —
  // neither the initial load nor the post-save id reconciliation count, or
  // every mount/save would fire a redundant (or, before this flag existed,
  // self-perpetuating) PUT.
  const dirtyRef = useRef(false);
  // Kept in sync with `fields` so mutators can read the latest value
  // synchronously (for history snapshots) without adding `fields` to every
  // callback's dependency array.
  const fieldsRef = useRef<FieldDto[]>([]);
  const historyRef = useRef<{ past: FieldDto[][]; future: FieldDto[][] }>({ past: [], future: [] });
  // Forces a re-render so canUndo/canRedo (read from the ref above) reflect
  // the latest history state — refs don't trigger renders on their own.
  const [, setHistoryVersion] = useState(0);
  const dragSnapshotRef = useRef<FieldDto[] | null>(null);
  const clipboardRef = useRef<FieldDto[] | null>(null);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authFetch(`/api/forms/${formId}`);
      if (cancelled) return;
      if (res.ok) {
        const body = await res.json();
        setForm(body.form);
        setFields(body.form.fields);
      }
      setLoading(false);
      hasLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const persistFields = useCallback(
    async (toSave: FieldDto[]) => {
      dirtyRef.current = false;
      setSaveStatus("saving");
      const payload = {
        fields: toSave.map((f) => ({
          id: f.id.startsWith("tmp-") ? undefined : f.id,
          type: f.type,
          label: f.label,
          required: f.required,
          order: f.order,
          config: f.config,
        })),
      };
      const res = await authFetch(`/api/forms/${formId}/fields`, { method: "PUT", body: JSON.stringify(payload) });
      if (!res.ok) {
        setSaveStatus("error");
        return;
      }
      const body = await res.json();
      const serverFields: FieldDto[] = body.fields;
      // Only produce a new array (and thus re-trigger the autosave effect) when a
      // temp id is actually being replaced — otherwise this resolves into an
      // infinite save loop, since a fresh array reference always re-fires the effect.
      setFields((prev) => {
        if (!prev.some((f) => f.id.startsWith("tmp-"))) return prev;
        const idMap = new Map<string, string>();
        const next = prev.map((f, i) => {
          if (f.id.startsWith("tmp-") && serverFields[i]) {
            idMap.set(f.id, serverFields[i].id);
            return { ...f, id: serverFields[i].id };
          }
          return f;
        });
        // A tmp- id that just became real might still be embedded in an
        // older history snapshot's Calculation formula token or condition
        // fieldId — remap those too, or an undo/redo could resurrect a
        // reference nothing points to anymore.
        if (idMap.size > 0) {
          const remapField = (f: FieldDto): FieldDto => {
            let changed = false;
            const config = { ...f.config };
            if (config.formula) {
              const remapped = config.formula.replace(/\{([^}]+)\}/g, (m, id) =>
                idMap.has(id) ? `{${idMap.get(id)}}` : m,
              );
              if (remapped !== config.formula) {
                config.formula = remapped;
                changed = true;
              }
            }
            if (config.conditions?.some((c) => idMap.has(c.fieldId))) {
              config.conditions = config.conditions.map((c) =>
                idMap.has(c.fieldId) ? { ...c, fieldId: idMap.get(c.fieldId)! } : c,
              );
              changed = true;
            }
            const id = idMap.get(f.id) ?? f.id;
            return changed || id !== f.id ? { ...f, id, config } : f;
          };
          const remapSnapshot = (snapshot: FieldDto[]) => snapshot.map(remapField);
          historyRef.current.past = historyRef.current.past.map(remapSnapshot);
          historyRef.current.future = historyRef.current.future.map(remapSnapshot);
          // selectedIds is compared directly against field.id elsewhere
          // (removeFields, duplicateFields, the page's selectedField lookup)
          // — left un-remapped, a field selected right before an autosave
          // reconciles its tmp- id would silently stop matching anything.
          setSelectedIds((prevSelected) => {
            if (![...prevSelected].some((id) => idMap.has(id))) return prevSelected;
            return new Set([...prevSelected].map((id) => idMap.get(id) ?? id));
          });
        }
        return next;
      });
      setSaveStatus("saved");
    },
    [authFetch, formId],
  );

  const debouncedPersist = useDebouncedCallback(persistFields, 900);

  useEffect(() => {
    if (!hasLoadedRef.current || !dirtyRef.current) return;
    debouncedPersist(fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const pushHistory = useCallback((snapshot: FieldDto[]) => {
    historyRef.current.past.push(snapshot);
    if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
    historyRef.current.future = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const addField = useCallback(
    (type: FieldType) => {
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => [
        ...prev,
        {
          id: tempId(),
          type,
          // A page break's label is an optional *next page* title, not
          // visitor-facing field content, so it starts blank rather than
          // pre-filled with "Page Break".
          label: type === "PAGE_BREAK" ? "" : FIELD_TYPE_LABELS[type],
          required: false,
          order: prev.length,
          config: defaultConfigFor(type),
        },
      ]);
    },
    [pushHistory],
  );

  const updateField = useCallback(
    (id: string, patch: Partial<FieldDto>) => {
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    [pushHistory],
  );

  const removeField = useCallback(
    (id: string) => {
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [pushHistory],
  );

  const removeFields = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => prev.filter((f) => !ids.has(f.id)).map((f, i) => ({ ...f, order: i })));
      setSelectedIds(new Set());
    },
    [pushHistory],
  );

  const duplicateField = useCallback(
    (id: string) => {
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => {
        const index = prev.findIndex((f) => f.id === id);
        if (index === -1) return prev;
        const clone = cloneField(prev[index], { label: `${prev[index].label} (copy)` });
        const next = [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
        return next.map((f, i) => ({ ...f, order: i }));
      });
    },
    [pushHistory],
  );

  const duplicateFields = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      pushHistory(fieldsRef.current);
      dirtyRef.current = true;
      setFields((prev) => {
        const next: FieldDto[] = [];
        const newIds: string[] = [];
        for (const f of prev) {
          next.push(f);
          if (ids.has(f.id)) {
            const clone = cloneField(f, { label: `${f.label} (copy)` });
            next.push(clone);
            newIds.push(clone.id);
          }
        }
        setSelectedIds(new Set(newIds));
        return next.map((f, i) => ({ ...f, order: i }));
      });
    },
    [pushHistory],
  );

  const reorderFields = useCallback((fromIndex: number, toIndex: number) => {
    dirtyRef.current = true;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  // A drag gesture calls reorderFields many times (once per hover frame), so
  // history is recorded once per *gesture* — snapshotting at drag start and
  // committing at drag end — rather than once per frame, or undo would only
  // step back one pixel of mouse movement at a time.
  const beginReorder = useCallback(() => {
    dragSnapshotRef.current = fieldsRef.current;
  }, []);

  const commitReorder = useCallback(() => {
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (!snapshot) return;
    const changed =
      snapshot.length !== fieldsRef.current.length || snapshot.some((f, i) => f.id !== fieldsRef.current[i]?.id);
    if (changed) pushHistory(snapshot);
  }, [pushHistory]);

  const undo = useCallback(() => {
    const { past } = historyRef.current;
    if (past.length === 0) return;
    const previous = past.pop()!;
    historyRef.current.future.push(fieldsRef.current);
    dirtyRef.current = true;
    setFields(previous);
    setSelectedIds(new Set());
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const { future } = historyRef.current;
    if (future.length === 0) return;
    const next = future.pop()!;
    historyRef.current.past.push(fieldsRef.current);
    dirtyRef.current = true;
    setFields(next);
    setSelectedIds(new Set());
    setHistoryVersion((v) => v + 1);
  }, []);

  const copyFields = useCallback((ids: Set<string>) => {
    const toCopy = fieldsRef.current.filter((f) => ids.has(f.id));
    if (toCopy.length > 0) clipboardRef.current = toCopy;
  }, []);

  const pasteFields = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.length === 0) return;
    pushHistory(fieldsRef.current);
    dirtyRef.current = true;
    setFields((prev) => {
      // Paste right after the current selection, or at the end if nothing's selected.
      let insertAt = prev.length;
      const selectedIndices = prev.map((f, i) => (selectedIds.has(f.id) ? i : -1)).filter((i) => i >= 0);
      if (selectedIndices.length > 0) insertAt = Math.max(...selectedIndices) + 1;

      const clones = clipboard.map((f) => cloneField(f));
      const next = [...prev.slice(0, insertAt), ...clones, ...prev.slice(insertAt)];
      setSelectedIds(new Set(clones.map((c) => c.id)));
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, [pushHistory, selectedIds]);

  const selectField = useCallback((id: string, index: number, modifiers: SelectModifiers) => {
    setSelectedIds((prev) => {
      if (modifiers.shiftKey && anchorIndexRef.current !== null) {
        const [start, end] = [anchorIndexRef.current, index].sort((a, b) => a - b);
        return new Set(fieldsRef.current.slice(start, end + 1).map((f) => f.id));
      }
      if (modifiers.ctrlKey || modifiers.metaKey) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
    if (!modifiers.shiftKey) anchorIndexRef.current = index;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const updateFormMetaImmediate = useCallback(
    async (patch: {
      title?: string;
      description?: string | null;
      status?: "DRAFT" | "PUBLISHED";
      departmentId?: string | null;
      requiresApproval?: boolean;
      approverRoleId?: string | null;
      productCode?: string | null;
      oneQuestionPerPage?: boolean;
    }) => {
      const res = await authFetch(`/api/forms/${formId}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (res.ok) {
        const body = await res.json();
        setForm((prev) => (prev ? { ...prev, ...body.form } : prev));
      }
      return res.ok;
    },
    [authFetch, formId],
  );

  const debouncedMetaSave = useDebouncedCallback(updateFormMetaImmediate, 700);

  return {
    form,
    fields,
    loading,
    saveStatus,
    selectedIds,
    selectField,
    clearSelection,
    addField,
    updateField,
    removeField,
    removeFields,
    duplicateField,
    duplicateFields,
    reorderFields,
    beginReorder,
    commitReorder,
    undo,
    redo,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
    copyFields,
    pasteFields,
    updateFormMetaImmediate,
    debouncedMetaSave,
  };
}
