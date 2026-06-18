import { db } from "@/lib/db";
import { studies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Study, StudyData } from "@/lib/studies/generators";

export interface StoredStudy {
  slug: string;
  type: string;
  title: string;
  dek: string;
  data: StudyData;
  pitchDraft: string | null;
  updatedAt: Date | null;
}

/** Upsert a study by slug (one canonical, freshening page per study type+season). */
export async function upsertStudy(study: Study, pitchDraft: string | null): Promise<void> {
  await db
    .insert(studies)
    .values({
      slug: study.slug,
      type: study.type,
      title: study.title,
      dek: study.dek,
      data: study.data,
      pitchDraft,
    })
    .onConflictDoUpdate({
      target: studies.slug,
      set: {
        title: study.title,
        dek: study.dek,
        data: study.data,
        ...(pitchDraft ? { pitchDraft } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function getStudyBySlug(slug: string): Promise<StoredStudy | null> {
  const [row] = await db.select().from(studies).where(eq(studies.slug, slug)).limit(1);
  if (!row || row.status !== "published") return null;
  return {
    slug: row.slug,
    type: row.type,
    title: row.title,
    dek: row.dek,
    data: row.data as StudyData,
    pitchDraft: row.pitchDraft,
    updatedAt: row.updatedAt,
  };
}

export async function listStudies(): Promise<StoredStudy[]> {
  const rows = await db
    .select()
    .from(studies)
    .where(eq(studies.status, "published"))
    .orderBy(desc(studies.updatedAt));
  return rows.map((row) => ({
    slug: row.slug,
    type: row.type,
    title: row.title,
    dek: row.dek,
    data: row.data as StudyData,
    pitchDraft: row.pitchDraft,
    updatedAt: row.updatedAt,
  }));
}
