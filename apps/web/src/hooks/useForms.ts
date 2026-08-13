"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormSummaryDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

export interface CreatableDepartment {
  id: string;
  name: string;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? "Couldn't import the form";
  } catch {
    return "Couldn't import the form";
  }
}

export function useForms() {
  const { authFetch } = useAuth();
  const [forms, setForms] = useState<FormSummaryDto[]>([]);
  const [creatableDepartments, setCreatableDepartments] = useState<CreatableDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [formsRes, deptRes] = await Promise.all([
        authFetch("/api/forms"),
        authFetch("/api/forms/my-departments"),
      ]);
      if (!formsRes.ok) throw new Error("Couldn't load your forms");
      setForms((await formsRes.json()).forms);
      setCreatableDepartments(deptRes.ok ? (await deptRes.json()).departments : []);
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
    async (title: string, departmentId?: string | null) => {
      const res = await authFetch("/api/forms", { method: "POST", body: JSON.stringify({ title, departmentId: departmentId ?? null }) });
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

  const duplicateForm = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/forms/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Couldn't duplicate the form");
      const body = await res.json();
      await reload();
      return body.form as FormSummaryDto;
    },
    [authFetch, reload],
  );

  const importForm = useCallback(
    async (exported: unknown) => {
      const res = await authFetch("/api/forms/import", { method: "POST", body: JSON.stringify(exported) });
      if (!res.ok) throw new Error(await parseError(res));
      const body = await res.json();
      await reload();
      return body.form as FormSummaryDto;
    },
    [authFetch, reload],
  );

  return {
    forms,
    creatableDepartments,
    loading,
    error,
    reload,
    createForm,
    renameForm,
    deleteForm,
    duplicateForm,
    importForm,
  };
}
