import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";

// Người dùng tự đổi mật khẩu của chính mình.
export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const current =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";

    if (current === "") {
      return NextResponse.json(
        { error: "Vui lòng nhập mật khẩu hiện tại." },
        { status: 400 },
      );
    }

    if (next.length < 8) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 8 ký tự." },
        { status: 400 },
      );
    }

    if (new TextEncoder().encode(next).length > 72) {
      return NextResponse.json(
        { error: "Mật khẩu quá dài (tối đa 72 byte)." },
        { status: 400 },
      );
    }

    if (next === current) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải khác mật khẩu hiện tại." },
        { status: 400 },
      );
    }

    const userId = BigInt(session.userId);

    const users = await prisma.$queryRaw<Array<{ password_hash: string }>>`
      SELECT password_hash
      FROM users
      WHERE id = ${userId} AND status = 'ACTIVE'
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản." },
        { status: 404 },
      );
    }

    const valid = await bcrypt.compare(current, users[0].password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không đúng." },
        { status: 400 },
      );
    }

    const hash = await bcrypt.hash(next, 10);

    await prisma.$executeRaw`
      UPDATE users SET password_hash = ${hash} WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: "Đã đổi mật khẩu.",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: "Không thể đổi mật khẩu." },
      { status: 500 },
    );
  }
}
