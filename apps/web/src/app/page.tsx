import Link from "next/link";
import { ArrowRight, MousePointerClick, ShieldCheck, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_theme(colors.brand.100),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_theme(colors.brand.900),_transparent_60%)] dark:bg-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold">Smart Form Builder</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started free
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
        <span className="rounded-full bg-brand-100 px-4 py-1 text-xs font-medium uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          Now in early access
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Build forms your audience actually finishes.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Drag, drop, and publish surveys, applications, and contact forms in minutes — then watch
          responses roll in on a dashboard built for clarity.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/register" className="btn-primary">
            Start building <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn-secondary">
            I already have an account
          </Link>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: MousePointerClick, title: "Drag & drop builder", body: "Compose forms visually with instant live preview." },
            { icon: Zap, title: "Publish in seconds", body: "Every form gets a shareable link the moment you publish." },
            { icon: ShieldCheck, title: "Built-in validation", body: "Required fields are enforced client- and server-side." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6 text-left">
              <Icon className="text-brand-500" size={22} />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
