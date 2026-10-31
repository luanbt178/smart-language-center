import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"

// Trả về thông tin người dùng đang đăng nhập (đọc từ JWT trong cookie).
export async function GET() {
  const session = await getCurrentSession()

  if (!session) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập." },
      { status: 401 },
    )
  }

  return NextResponse.json(
    {
      role: session.role,
      user: {
        userId: session.userId,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        roleName: session.roleName,
        permissions: session.permissions,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}