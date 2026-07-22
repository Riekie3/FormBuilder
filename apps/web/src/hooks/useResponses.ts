"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormDetailDto, ResponseDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

export function useResponses(formId: string, search: string) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<FormDetailDto | null>(null);
  const [responses, setResponses] = useState<ResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [formRes, responsesRes] = await Promise.all([
        authFetch(`/api/forms/${formId}`),
        authFetch(`/api/forms/${formId}/responses?search=${encodeURIComponent(search)}`),
      ]);
      if (!formRes.ok || !responsesRes.ok) throw new Error("Couldn't load responses");
      const formBody = await formRes.json();
      const responsesBody = await responsesRes.json();
      setForm(formBody.form);
      setResponses(responsesBody.responses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load responses");
    } finally {
      setLoading(false);
    }
  }, [authFetch, formId, search]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteResponse = useCallback(
    async (responseId: string) => {
      const res = await authFetch(`/api/forms/${formId}/responses/${responseId}`, { method: "DELETE" });
      if (res.ok) setResponses((prev) => prev.filter((r) => r.id !== responseId));
    },
    [authFetch, formId],
  );

  const exportCsv = useCallback(async () => {
    const res = await authFetch(`/api/forms/${formId}/responses/export`);
    if (!res.ok) throw new Error("Couldn't export responses");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form?.slug ?? "responses"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [authFetch, formId, form?.slug]);

  return { form, responses, loading, error, deleteResponse, exportCsv, reload: load };
}
