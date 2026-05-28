import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  articles,
  competitions,
  sportsEvents,
} from "@/lib/db/schema";
import { EventRow } from "./event-row";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type AdminEventRow = {
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

function parseMonthParam(raw: string | undefined): { year: number; month: number } {
  const fallback = () => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  };
  if (!raw) return fallback();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return fallback();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return fallback();
  }
  return { year, month };
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  return { start, end };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

async function loadEventsForMonth(
  year: number,
  month: number
): Promise<AdminEventRow[]> {
  const { start, end } = monthRange(year, month);
  const startStr = toIsoDate(start);
  const endStr = toIsoDate(end);

  const rows = await db
    .select({
      id: sportsEvents.id,
      date: sportsEvents.date,
      type: sportsEvents.type,
      title: sportsEvents.title,
      description: sportsEvents.description,
      importance: sportsEvents.importance,
      isFeatured: sportsEvents.isFeatured,
      matchIds: sportsEvents.matchIds,
      competitionId: sportsEvents.competitionId,
      competitionName: competitions.name,
    })
    .from(sportsEvents)
    .leftJoin(competitions, eq(sportsEvents.competitionId, competitions.id))
    .where(
      and(
        gte(sportsEvents.date, startStr),
        lte(sportsEvents.date, endStr)
      )
    )
    .orderBy(asc(sportsEvents.date), asc(sportsEvents.importance));

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const eventArticles = await db
    .select({
      eventId: articles.sportsEventId,
      type: articles.type,
    })
    .from(articles)
    .where(inArray(articles.sportsEventId, ids));

  const previewMap = new Set<string>();
  const recapMap = new Set<string>();
  for (const a of eventArticles) {
    if (!a.eventId) continue;
    if (a.type === "event_preview") previewMap.add(a.eventId);
    if (a.type === "event_recap") recapMap.add(a.eventId);
  }

  return rows.map((r) => ({
    id: r.id,
    date: String(r.date),
    type: r.type,
    title: r.title,
    description: r.description,
    importance: r.importance,
    isFeatured: r.isFeatured,
    matchIds: (r.matchIds as string[]) ?? [],
    competitionId: r.competitionId,
    competitionName: r.competitionName,
    hasPreview: previewMap.has(r.id),
    hasRecap: recapMap.has(r.id),
  }));
}

function groupByDate(events: AdminEventRow[]): Map<string, AdminEventRow[]> {
  const map = new Map<string, AdminEventRow[]>();
  for (const ev of events) {
    const key = ev.date;
    const bucket = map.get(key) ?? [];
    bucket.push(ev);
    map.set(key, bucket);
  }
  return map;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin/calendar");
  if (user.role !== "admin") notFound();

  const { month: rawMonth } = await searchParams;
  const { year, month } = parseMonthParam(rawMonth);

  const events = await loadEventsForMonth(year, month);
  const grouped = groupByDate(events);
  const dates = [...grouped.keys()].sort();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const totals = {
    all: events.length,
    highImportance: events.filter((e) => e.importance >= 4).length,
    withPreview: events.filter((e) => e.hasPreview).length,
    withRecap: events.filter((e) => e.hasRecap).length,
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Sports Calendar</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Curate events and trigger AI previews & recaps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?month=${formatMonthParam(prev.year, prev.month)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Link>
          <div className="min-w-[140px] text-center text-sm font-semibold text-neutral-900">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <Link
            href={`/admin/calendar?month=${formatMonthParam(next.year, next.month)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events" value={totals.all} />
        <StatCard
          label="Importance ≥ 4"
          value={totals.highImportance}
          icon={<Flame className="h-4 w-4 text-orange-500" />}
        />
        <StatCard
          label="With preview"
          value={totals.withPreview}
          icon={<Trophy className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          label="With recap"
          value={totals.withRecap}
          icon={<Trophy className="h-4 w-4 text-green-600" />}
        />
      </div>

      {dates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
          No events for {MONTH_NAMES[month - 1]} {year}. Run the calendar
          generator to backfill events for this window.
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => {
            const dayEvents = grouped.get(date) ?? [];
            return (
              <div
                key={date}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-3">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {formatDayLabel(date)}
                  </h2>
                </div>
                <div className="divide-y divide-neutral-100">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold text-neutral-900">{value}</div>
    </div>
  );
}
