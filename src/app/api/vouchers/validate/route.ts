import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { voucherCodes } from "@/lib/db/schema";
import { eq, and, lte, or, isNull, gt } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const validateSchema = z.object({
  code: z.string().min(1, "Voucher code is required").trim(),
});

/**
 * GET /api/vouchers/validate?code=X — what the pricing page actually calls
 * (it used to GET a POST-only route, so every code entry 405'd). Anonymous-
 * friendly: validation is read-only and pricing visitors are usually logged
 * out. Returns the { valid, discount, message } shape the pricing UI renders.
 */
export async function GET(request: NextRequest) {
  try {
    const code = (request.nextUrl.searchParams.get("code") ?? "").trim();
    if (!code) {
      return NextResponse.json({ valid: false, message: "Enter a promo code" }, { status: 400 });
    }

    const now = new Date();
    const [voucher] = await db
      .select()
      .from(voucherCodes)
      .where(
        and(
          eq(voucherCodes.code, code),
          lte(voucherCodes.validFrom, now),
          or(isNull(voucherCodes.validTo), gt(voucherCodes.validTo, now))
        )
      )
      .limit(1);

    if (!voucher) {
      return NextResponse.json({ valid: false, message: "Invalid or expired promo code" }, { status: 404 });
    }
    if (voucher.maxUses !== null && voucher.currentUses >= voucher.maxUses) {
      return NextResponse.json({ valid: false, message: "This promo code has reached its maximum uses" }, { status: 410 });
    }

    const discount =
      voucher.discountType === "percent_off"
        ? `${voucher.discountValue}% off`
        : `${voucher.discountValue} free month${voucher.discountValue === 1 ? "" : "s"}`;

    return NextResponse.json({
      valid: true,
      discount,
      message: `${voucher.code} is valid — enter it at checkout to apply the discount.`,
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    return NextResponse.json({ valid: false, message: "Could not validate code" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { code } = parsed.data;
    const now = new Date();

    const [voucher] = await db
      .select()
      .from(voucherCodes)
      .where(
        and(
          eq(voucherCodes.code, code),
          lte(voucherCodes.validFrom, now),
          or(isNull(voucherCodes.validTo), gt(voucherCodes.validTo, now))
        )
      )
      .limit(1);

    if (!voucher) {
      return NextResponse.json(
        { error: "Invalid or expired voucher code" },
        { status: 404 }
      );
    }

    if (voucher.maxUses !== null && voucher.currentUses >= voucher.maxUses) {
      return NextResponse.json(
        { error: "This voucher code has reached its maximum number of uses" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
      },
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    return NextResponse.json(
      { error: "Failed to validate voucher code" },
      { status: 500 }
    );
  }
}
