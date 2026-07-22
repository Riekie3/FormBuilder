"use client";

import { useCallback, useEffect, useState } from "react";
import type { PendingApprovalDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

export function useApprovals() {
  const { authFetch } = useAuth();
  const [pending, setPending] = useState<PendingApprovalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/forms/pending-approvals");
      if (!res.ok) throw new Error("Couldn't load pending approvals");
      setPending((await res.json()).pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load pending approvals");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const decide = useCallback(
    async (formId: string, responseId: string, decision: "APPROVED" | "REJECTED", comment: string) => {
      const res = await authFetch(`/api/forms/${formId}/responses/${responseId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't record the decision");
      }
      setPending((prev) => prev.filter((p) => p.responseId !== responseId));
    },
    [authFetch],
  );

  return { pending, loading, error, decide, reload };
}
