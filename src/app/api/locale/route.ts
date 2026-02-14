import { NextRequest, NextResponse } from "next/server";
import { locales, type Locale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();

    if (!locales.includes(locale as Locale)) {
      return NextResponse.json(
        { error: "Invalid locale" },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ success: true, locale });

    // Set locale cookie (1 year expiry)
    response.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to update locale" },
      { status: 500 }
    );
  }
}
