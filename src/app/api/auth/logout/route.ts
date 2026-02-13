import { NextResponse } from "next/server";
import {
  getSessionCookie,
  deleteSession,
  deleteSessionCookie,
} from "@/lib/auth";

export async function POST() {
  try {
    const token = await getSessionCookie();

    if (token) {
      await deleteSession(token);
      await deleteSessionCookie();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
