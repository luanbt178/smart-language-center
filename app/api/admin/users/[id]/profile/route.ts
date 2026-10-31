import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Sửa họ tên, email, số điện thoại của một tài khoản.
export async function PATCH(request: Request, { params }: Params) {
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

    const fullName = cleanText(body.fullName);
    const email = cleanText(body.email);
    const phone = cleanText(body.phone);

    if (fullName.length < 1 || fullName.length > 150) {
      return NextResponse.json(
        { error: "Họ tên không được để trống (tối đa 150 ký tự)." },
        { status: 400 },
      );
    }

    if (email && (email.length > 150 || !EMAIL_PATTERN.test(email))) {
      return NextResponse.json(
        { error: "Email không hợp lệ." },
        { status: 400 },
      );
    }

    if (phone.length > 30) {
      return NextResponse.json(
        { error: "Số điện thoại quá dài (tối đa 30 ký tự)." },
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

    await prisma.$executeRaw`
      UPDATE users
      SET full_name = ${fullName},
          email = ${email || null},
          phone = ${phone || null}
      WHERE id = ${userId}
    `;

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật thông tin tài khoản.",
    });
  } catch (error) {
    if (error instanceof Error && /duplicate/i.test(error.message)) {
      return NextResponse.json(
        { error: "Email này đã được dùng cho tài khoản khác." },
        { status: 409 },
      );
    }

    console.error("UPDATE USER PROFILE ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật tài khoản." },
      { status: 500 },
    );
  }
}