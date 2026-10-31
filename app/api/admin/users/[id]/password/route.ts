import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// Quản trị đặt lại mật khẩu cho một tài khoản.
export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission("USER_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID tài khoản không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const password =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 8 ký tự." },
        { status: 400 },
      );
    }

    // bcrypt chỉ dùng tối đa 72 byte đầu của mật khẩu.
    if (new TextEncoder().encode(password).length > 72) {
      return NextResponse.json(
        { error: "Mật khẩu quá dài (tối đa 72 byte)." },
        { status: 400 },
      );
    }

    const userId = BigInt(id);

    const targets = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM users WHERE id = ${userId} LIMIT 1
    `;

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản." },
        { status: 404 },
      );
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.$executeRaw`
      UPDATE users SET password_hash = ${hash} WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message:
        "Đã đặt lại mật khẩu. Hãy gửi mật khẩu mới cho người dùng. Phiên đăng nhập cũ (nếu có) sẽ hết hạn theo thời gian.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: "Không thể đặt lại mật khẩu." },
      { status: 500 },
    );
  }
}