"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Pencil, Sparkles, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type EventRowData = {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string | null;
  importance: number;
  isFeatured: boolean;
  matchIds: string[];
  competitionId: string | null;
  competitionName: string | null;
  hasPreview: boolean;
  hasRecap: boolean;
};

const TYPE_BADGE: Record<string, string> = {
  matchday: "bg-blue-50 text-blue-700",
  derby: "bg-orange-50 text-orange-700",
  final: "bg-purple-50 text-purple-700",
  tournament_start: "bg-indigo-50 text-indigo-700",
  international_break: "bg-neutral-100 text-neutral-600",
};

function formatEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function EventRow({ event: initial }: { event: EventRowData }) {
  const router = useRouter();
  const [event, setEvent] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [draftTitle, setDraftTitle] = useState(event.title);
  const [draftDescription, setDraftDescription] = useState(event.description ?? "");
  const [draftImportance, setDraftImportance] = useState(event.importance);
  const [draftFeatured, setDraftFeatured] = useState(event.isFeatured);

  function beginEdit() {
    setDraftTitle(event.title);
    setDraftDescription(event.description ?? "");
    setDraftImportance(event.importance);
    setDraftFeatured(event.isFeatured);
    setEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim() || null,
          importance: draftImportance,
          isFeatured: draftFeatured,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update event");
      }
      const data = (await res.json()) as { event: EventRowData };
      setEvent(data.event);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete event");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function generate(type: "preview" | "recap") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/events/${event.id}/generate?type=${type}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to generate");
      }
      if (type === "preview") setEvent((e) => ({ ...e, hasPreview: true }));
      else setEvent((e) => ({ ...e, hasRecap: true }));
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("px-6 py-4", busy && "opacity-60")}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                TYPE_BADGE[event.type] ?? "bg-neutral-100 text-neutral-700"
              )}
            >
              {formatEventType(event.type)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
              <Star className="h-3 w-3" />
              {event.importance}/5
            </span>
            {event.isFeatured && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Featured
              </span>
            )}
            {event.competitionName && (
              <span className="text-xs text-neutral-500">
                {event.competitionName}
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Event title"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none"
              />
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={2}
                placeholder="Optional description"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                  Importance: {draftImportance}
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={draftImportance}
                    onChange={(e) => setDraftImportance(Number(e.target.value))}
                    className="w-32"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={draftFeatured}
                    onChange={(e) => setDraftFeatured(e.target.checked)}
                  />
                  Featured
                </label>
              </div>
            </div>
          ) : (
            <>
              <h3 className="mt-2 text-base font-semibold text-neutral-900">
                {event.title}
              </h3>
              {event.description && (
                <p className="mt-1 text-sm text-neutral-600">{event.description}</p>
              )}
              <p className="mt-1 text-xs text-neutral-400">
                {event.matchIds.length} linked match
                {event.matchIds.length === 1 ? "" : "es"}
              </p>
            </>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={busy || draftTitle.trim().length === 0}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </button>
              <button
                onClick={cancelEdit}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={beginEdit}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}

          {!editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => generate("preview")}
                disabled={busy || event.hasPreview}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  event.hasPreview
                    ? "border border-blue-200 bg-blue-50 text-blue-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
                title={event.hasPreview ? "Preview already exists" : "Generate preview"}
              >
                {event.hasPreview ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {event.hasPreview ? "Preview ✓" : "Gen preview"}
              </button>
              <button
                onClick={() => generate("recap")}
                disabled={busy || event.hasRecap}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  event.hasRecap
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                )}
                title={event.hasRecap ? "Recap already exists" : "Generate recap"}
              >
                {event.hasRecap ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {event.hasRecap ? "Recap ✓" : "Gen recap"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
