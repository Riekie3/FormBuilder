"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldDto, FieldOption, FieldType, FormDetailDto } from "@sfb/shared";
import { fieldSupportsOptions, FIELD_TYPE_LABELS } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

function tempId() {
  return `tmp-${crypto.randomUUID()}`;
}

function defaultConfigFor(type: FieldType) {
  if (fieldSupportsOptions(type)) {
    const options: FieldOption[] = [
      { id: crypto.randomUUID(), label: "Option 1", value: "option-1" },
      { id: crypto.randomUUID(), label: "Option 2", value: "option-2" },
    ];
    return { options };
  }
  return {};
}

export function useFormBuilder(formId: string) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<FormDetailDto | null>(null);
  const [fields, setFields] = useState<FieldDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  // Only real user edits (via the mutators below) should trigger an autosave —
  // neither the initial load nor the post-save id reconciliation count, or
  // every mount/save would fire a redundant (or, before this flag existed,
  // self-perpetuating) PUT.
  const dirtyRef = useRef(false);

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
      setFields((prev) =>
        prev.some((f) => f.id.startsWith("tmp-"))
          ? prev.map((f, i) => (f.id.startsWith("tmp-") ? { ...f, id: serverFields[i]?.id ?? f.id } : f))
          : prev,
      );
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

  const addField = useCallback((type: FieldType) => {
    dirtyRef.current = true;
    setFields((prev) => [
      ...prev,
      {
        id: tempId(),
        type,
        label: FIELD_TYPE_LABELS[type],
        required: false,
        order: prev.length,
        config: defaultConfigFor(type),
      },
    ]);
  }, []);

  const updateField = useCallback((id: string, patch: Partial<FieldDto>) => {
    dirtyRef.current = true;
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const removeField = useCallback(
    (id: string) => {
      dirtyRef.current = true;
      setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })));
      setSelectedFieldId((current) => (current === id ? null : current));
    },
    [],
  );

  const duplicateField = useCallback((id: string) => {
    dirtyRef.current = true;
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index === -1) return prev;
      const clone: FieldDto = {
        ...prev[index],
        id: tempId(),
        label: `${prev[index].label} (copy)`,
        config: {
          ...prev[index].config,
          options: prev[index].config.options?.map((o) => ({ ...o })),
        },
      };
      const next = [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const reorderFields = useCallback((fromIndex: number, toIndex: number) => {
    dirtyRef.current = true;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const updateFormMetaImmediate = useCallback(
    async (patch: { title?: string; description?: string | null; status?: "DRAFT" | "PUBLISHED" }) => {
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
    selectedFieldId,
    setSelectedFieldId,
    addField,
    updateField,
    removeField,
    duplicateField,
    reorderFields,
    updateFormMetaImmediate,
    debouncedMetaSave,
  };
}
