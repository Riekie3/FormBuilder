"use client";

import { useEffect, useState } from "react";
import type { FormDetailDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

interface AvailableRole {
  id: string;
  name: string;
}

interface Props {
  form: FormDetailDto;
  onUpdate: (patch: { requiresApproval?: boolean; approverRoleId?: string | null }) => Promise<boolean>;
}

export function ApprovalSettings({ form, onUpdate }: Props) {
  const { authFetch } = useAuth();
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/forms/available-roles").then(async (res) => {
      if (res.ok) setRoles((await res.json()).roles);
    });
  }, [authFetch]);

  if (!form.departmentId) {
    return (
      <div className="card p-4 text-sm text-slate-500 dark:text-slate-400">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Approval workflow</h3>
        Move this form into a department to enable an approval step.
      </div>
    );
  }

  async function toggle(next: boolean) {
    setSaving(true);
    await onUpdate({
      requiresApproval: next,
      approverRoleId: next ? (form.approverRoleId ?? roles[0]?.id ?? null) : null,
    });
    setSaving(false);
  }

  async function changeRole(roleId: string) {
    setSaving(true);
    await onUpdate({ requiresApproval: true, approverRoleId: roleId });
    setSaving(false);
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approval workflow</h3>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.requiresApproval}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4 rounded accent-brand-500"
        />
        Require approval before a submission is final
      </label>
      {form.requiresApproval && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Approver role (in {form.departmentName})
          </label>
          <select
            value={form.approverRoleId ?? ""}
            disabled={saving}
            onChange={(e) => changeRole(e.target.value)}
            className="input-field"
          >
            <option value="" disabled>
              Select a role...
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">
            Anyone holding this role in {form.departmentName} can approve or reject submissions.
          </p>
        </div>
      )}
    </div>
  );
}
