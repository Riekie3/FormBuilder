"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DashboardShell } from "@/components/DashboardShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";

type PendingDelete = { kind: "department" | "role" | "membership"; id: string; label: string } | null;

function DepartmentsSection({
  departments,
  onCreate,
  onRequestDelete,
}: {
  departments: { id: string; name: string }[];
  onCreate: (name: string) => Promise<void>;
  onRequestDelete: (id: string, label: string) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create department");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-slate-900 dark:text-white">Departments</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Forms assigned to a department are visible to everyone with a role in it.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New department name..."
          className="input-field"
        />
        <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary shrink-0">
          <Plus size={16} /> Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700 dark:text-slate-300">{d.name}</span>
            <button
              type="button"
              onClick={() => onRequestDelete(d.id, d.name)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              aria-label={`Delete ${d.name}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {departments.length === 0 && <li className="py-2 text-sm text-slate-400">No departments yet.</li>}
      </ul>
    </div>
  );
}

function RolesSection({
  roles,
  onCreate,
  onRequestDelete,
}: {
  roles: { id: string; name: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[];
  onCreate: (data: { name: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }) => Promise<void>;
  onRequestDelete: (id: string, label: string) => void;
}) {
  const [name, setName] = useState("");
  const [canView, setCanView] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), canView, canCreate, canEdit, canDelete });
      setName("");
      setCanView(true);
      setCanCreate(false);
      setCanEdit(false);
      setCanDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-slate-900 dark:text-white">Roles</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Custom roles define what a department member can do to that department's forms.
      </p>

      <div className="mt-4 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New role name (e.g. Approver)..."
          className="input-field"
        />
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
          {(
            [
              ["View", canView, setCanView],
              ["Create", canCreate, setCanCreate],
              ["Edit", canEdit, setCanEdit],
              ["Delete", canDelete, setCanDelete],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="flex items-center gap-1.5">
              <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} className="h-4 w-4 accent-brand-500" />
              {label}
            </label>
          ))}
          <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary ml-auto">
            <Plus size={16} /> Add role
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {roles.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">{r.name}</span>
              <span className="ml-2 text-xs text-slate-400">
                {[r.canView && "View", r.canCreate && "Create", r.canEdit && "Edit", r.canDelete && "Delete"].filter(Boolean).join(" · ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRequestDelete(r.id, r.name)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              aria-label={`Delete ${r.name}`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {roles.length === 0 && <li className="py-2 text-sm text-slate-400">No roles yet.</li>}
      </ul>
    </div>
  );
}

function MembersSection({
  users,
  departments,
  roles,
  memberships,
  onCreate,
  onRequestDelete,
}: {
  users: { id: string; name: string; email: string }[];
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  memberships: { id: string; userName: string; userEmail: string; departmentName: string; roleName: string }[];
  onCreate: (data: { userId: string; departmentId: string; roleId: string }) => Promise<void>;
  onRequestDelete: (id: string, label: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!userId || !departmentId || !roleId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ userId, departmentId, roleId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't assign role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-slate-900 dark:text-white">Members</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Assign a user a role within a department. A user can hold several of these at once.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="input-field flex-1">
          <option value="">Select a user...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field flex-1">
          <option value="">Select a department...</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="input-field flex-1">
          <option value="">Select a role...</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary shrink-0">
          <Plus size={16} /> Assign
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {memberships.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700 dark:text-slate-300">
              {m.userName} <span className="text-slate-400">({m.userEmail})</span> — <strong>{m.roleName}</strong> in{" "}
              {m.departmentName}
            </span>
            <button
              type="button"
              onClick={() => onRequestDelete(m.id, `${m.userName} — ${m.roleName} in ${m.departmentName}`)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              aria-label="Remove assignment"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {memberships.length === 0 && <li className="py-2 text-sm text-slate-400">No members assigned yet.</li>}
      </ul>
    </div>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const {
    departments,
    roles,
    users,
    memberships,
    loading,
    error,
    createDepartment,
    deleteDepartment,
    createRole,
    deleteRole,
    createMembership,
    deleteMembership,
  } = useAdmin();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);

  if (!user?.isSuperAdmin) {
    return (
      <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        You need admin access to view this page.
      </div>
    );
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "department") await deleteDepartment(pendingDelete.id);
      if (pendingDelete.kind === "role") await deleteRole(pendingDelete.id);
      if (pendingDelete.kind === "membership") await deleteMembership(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Admin</h1>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-6">
          <DepartmentsSection
            departments={departments}
            onCreate={createDepartment}
            onRequestDelete={(id, label) => setPendingDelete({ kind: "department", id, label })}
          />
          <RolesSection
            roles={roles}
            onCreate={createRole}
            onRequestDelete={(id, label) => setPendingDelete({ kind: "role", id, label })}
          />
          <MembersSection
            users={users}
            departments={departments}
            roles={roles}
            memberships={memberships}
            onCreate={createMembership}
            onRequestDelete={(id, label) => setPendingDelete({ kind: "membership", id, label })}
          />
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.label}"?`}
          message={
            pendingDelete.kind === "department"
              ? "Forms in this department will become private to their owner. This cannot be undone."
              : pendingDelete.kind === "role"
                ? "Anyone holding this role will lose the access it granted. This cannot be undone."
                : "This user will lose the access this assignment granted."
          }
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGate>
      <DashboardShell>
        <AdminContent />
      </DashboardShell>
    </AuthGate>
  );
}
