"use client";

import Link from "next/link";
import { LayoutGrid, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-transparent dark:from-slate-900 dark:to-slate-950">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <LayoutGrid className="text-brand-500" size={20} />
            Smart Form Builder
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">{user?.email}</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
