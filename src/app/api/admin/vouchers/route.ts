import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voucherCodes, voucherRedemptions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, count, sql } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vouchers = await db
      .select({
        id: voucherCodes.id,
        code: voucherCodes.code,
        type: voucherCodes.type,
        discountType: voucherCodes.discountType,
        discountValue: voucherCodes.discountValue,
        maxUses: voucherCodes.maxUses,
        currentUses: voucherCodes.currentUses,
        validFrom: voucherCodes.validFrom,
        validTo: voucherCodes.validTo,
        createdAt: voucherCodes.createdAt,
        redemptionCount: count(voucherRedemptions.id),
      })
      .from(voucherCodes)
      .leftJoin(
        voucherRedemptions,
        eq(voucherRedemptions.voucherCodeId, voucherCodes.id)
      )
      .groupBy(voucherCodes.id)
      .orderBy(sql`${voucherCodes.createdAt} DESC`);

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error("Admin vouchers GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { code, type, discountType, discountValue, maxUses, validTo } = body;

    if (!code || !type || !discountType || discountValue == null) {
      return NextResponse.json(
        { error: "Missing required fields: code, type, discountType, discountValue" },
        { status: 400 }
      );
    }

    if (!["promo", "referral"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'promo' or 'referral'" },
        { status: 400 }
      );
    }

    if (!["free_months", "percent_off"].includes(discountType)) {
      return NextResponse.json(
        { error: "Invalid discountType. Must be 'free_months' or 'percent_off'" },
        { status: 400 }
      );
    }

    const [voucher] = await db
      .insert(voucherCodes)
      .values({
        code: code.toUpperCase(),
        type,
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses ? Number(maxUses) : null,
        validTo: validTo ? new Date(validTo) : null,
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    console.error("Admin vouchers POST error:", error);

    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      return NextResponse.json(
        { error: "A voucher with this code already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { voucherId } = body;

    if (!voucherId) {
      return NextResponse.json(
        { error: "Missing required field: voucherId" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(voucherCodes)
      .where(eq(voucherCodes.id, voucherId))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Voucher not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin vouchers DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
