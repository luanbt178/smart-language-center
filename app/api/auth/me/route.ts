// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  // Đọc cookie (thường được lưu dưới tên 'session' hoặc 'token')
  const cookieStore = await cookies();
  const sessionData = cookieStore.get('session')?.value;
  
  if (!sessionData) return NextResponse.json({ error: "No session" }, { status: 401 });

  try {
    // Giải mã JSON từ cookie để lấy role
    const parsed = JSON.parse(sessionData);
    return NextResponse.json({ role: parsed.role });
  } catch (error) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
}