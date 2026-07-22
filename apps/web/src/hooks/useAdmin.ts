"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUserDto, DepartmentDto, MembershipDto, RoleDto } from "@sfb/shared";
import { useAuth } from "@/context/AuthContext";

export function useAdmin() {
  const { authFetch } = useAuth();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [memberships, setMemberships] = useState<MembershipDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, roleRes, userRes, membershipRes] = await Promise.all([
        authFetch("/api/admin/departments"),
        authFetch("/api/admin/roles"),
        authFetch("/api/admin/users"),
        authFetch("/api/admin/memberships"),
      ]);
      if (!deptRes.ok || !roleRes.ok || !userRes.ok || !membershipRes.ok) {
        throw new Error("Couldn't load admin data");
      }
      setDepartments((await deptRes.json()).departments);
      setRoles((await roleRes.json()).roles);
      setUsers((await userRes.json()).users);
      setMemberships((await membershipRes.json()).memberships);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load admin data");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function parseErrorBody(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      return body.error ?? fallback;
    } catch {
      return fallback;
    }
  }

  const createDepartment = useCallback(
    async (name: string) => {
      const res = await authFetch("/api/admin/departments", { method: "POST", body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't create department"));
      await reload();
    },
    [authFetch, reload],
  );

  const deleteDepartment = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/admin/departments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't delete department"));
      await reload();
    },
    [authFetch, reload],
  );

  const createRole = useCallback(
    async (data: { name: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }) => {
      const res = await authFetch("/api/admin/roles", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't create role"));
      await reload();
    },
    [authFetch, reload],
  );

  const deleteRole = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/admin/roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't delete role"));
      await reload();
    },
    [authFetch, reload],
  );

  const createMembership = useCallback(
    async (data: { userId: string; departmentId: string; roleId: string }) => {
      const res = await authFetch("/api/admin/memberships", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't assign role"));
      await reload();
    },
    [authFetch, reload],
  );

  const deleteMembership = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/admin/memberships/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseErrorBody(res, "Couldn't remove assignment"));
      await reload();
    },
    [authFetch, reload],
  );

  return {
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
  };
}
