"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormSummaryDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

export function useForms() {
  const { authFetch } = useAuth();
  const [forms, setForms] = useState<FormSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/forms");
      if (!res.ok) throw new Error("Couldn't load your forms");
      const body = await res.json();
      setForms(body.forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your forms");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createForm = useCallback(
    async (title: string) => {
      const res = await authFetch("/api/forms", { method: "POST", body: JSON.stringify({ title }) });
      if (!res.ok) throw new Error("Couldn't create the form");
      const body = await res.json();
      await reload();
      return body.form as FormSummaryDto;
    },
    [authFetch, reload],
  );

  const renameForm = useCallback(
    async (id: string, title: string) => {
      const res = await authFetch(`/api/forms/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      if (!res.ok) throw new Error("Couldn't rename the form");
      await reload();
    },
    [authFetch, reload],
  );

  const deleteForm = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't delete the form");
      await reload();
    },
    [authFetch, reload],
  );

  return { forms, loading, error, reload, createForm, renameForm, deleteForm };
}
