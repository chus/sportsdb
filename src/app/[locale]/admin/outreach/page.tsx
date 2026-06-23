"use client";

import { useState, useEffect } from "react";
import { Mail, Plus, Trash2, ExternalLink } from "lucide-react";

interface Target {
  id: string;
  name: string;
  outlet: string | null;
  email: string | null;
  handle: string | null;
  beat: string | null;
  category: string;
  url: string | null;
  status: string;
  notes: string | null;
  lastStudyPitched: string | null;
}

const STATUSES = ["new", "contacted", "replied", "won", "dead"];
const CATEGORIES = ["journalist", "creator", "platform", "community", "newsletter"];
const STATUS_COLOR: Record<string, string> = {
  new: "bg-surface-2 text-muted",
  contacted: "bg-blue-100 text-blue-700",
  replied: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  dead: "bg-red-50 text-red-600",
};

export default function AdminOutreachPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", outlet: "", email: "", handle: "", beat: "", category: "journalist", url: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/outreach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTargets(d.targets))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => fetch("/api/admin/outreach").then((r) => (r.ok ? r.json() : null)).then((d) => d && setTargets(d.targets));

  const add = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/admin/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", outlet: "", email: "", handle: "", beat: "", category: "journalist", url: "", notes: "" });
    setSaving(false);
    reload();
  };
  const patch = async (id: string, fields: Partial<Target>) => {
    setTargets((t) => t.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    await fetch("/api/admin/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...fields }) });
  };
  const remove = async (id: string) => {
    setTargets((t) => t.filter((x) => x.id !== id));
    await fetch(`/api/admin/outreach?id=${id}`, { method: "DELETE" });
  };

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-blue-600" /></div>;

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: targets.filter((t) => t.status === s).length }), {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Mail className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-ink">PR Outreach</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Targets to pitch the weekly data studies to. Keep it small and personalized — automated blasting gets ~1-2% vs 15-20% for tailored sends.
        Seeded with public channels; add specific contacts as you find them.
      </p>

      {/* counts */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map((s) => (
          <span key={s} className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLOR[s]}`}>{s}: {counts[s] ?? 0}</span>
        ))}
      </div>

      {/* add form */}
      <div className="rounded-xl border border-line bg-surface p-4 mb-6">
        <div className="grid sm:grid-cols-3 gap-2 mb-2">
          <input className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="Outlet" value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })} />
          <select className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="Handle (@)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
          <input className="px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="Beat (FPL, data…)" value={form.beat} onChange={(e) => setForm({ ...form, beat: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 text-sm border border-line rounded-lg bg-surface" placeholder="URL / notes" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <button onClick={add} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-muted text-left">
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Beat</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink flex items-center gap-1.5">
                    {t.name}
                    {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 text-faint" /></a>}
                  </div>
                  <div className="text-xs text-muted">{t.outlet} · {t.category}</div>
                </td>
                <td className="px-4 py-3 text-muted hidden md:table-cell">{t.beat ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {t.email && <div>{t.email}</div>}
                  {t.handle && <div>{t.handle}</div>}
                  {!t.email && !t.handle && "—"}
                </td>
                <td className="px-4 py-3">
                  <select value={t.status} onChange={(e) => patch(t.id, { status: e.target.value })} className={`text-xs rounded-full px-2 py-1 border-0 ${STATUS_COLOR[t.status]}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                  <input
                    defaultValue={t.notes ?? ""}
                    onBlur={(e) => e.target.value !== (t.notes ?? "") && patch(t.id, { notes: e.target.value })}
                    placeholder="notes…"
                    className="w-full px-2 py-1 text-xs border border-transparent hover:border-line focus:border-line rounded bg-transparent text-muted"
                  />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => remove(t.id)} className="text-faint hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
