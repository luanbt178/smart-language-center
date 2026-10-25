import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { readText } from "@/lib/students";

type RoomRow = {
  id: bigint;
  branch_id: bigint;
  branch_name: string;
  code: string;
  name: string | null;
  capacity: number;
  status: string;
};

export async function GET() {
  const auth = await requireApiPermission("CLASS_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const rooms = await prisma.$queryRaw<RoomRow[]>`
      SELECT r.id, r.branch_id, b.name AS branch_name, r.code, r.name, r.capacity, r.status
      FROM rooms r
      INNER JOIN branches b ON b.id = r.branch_id
      WHERE EXISTS (
        SELECT 1 FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId} AND scope.branch_id = r.branch_id
      )
      ORDER BY b.name, r.code
    `;

    const branches = await prisma.$queryRaw<
      Array<{ id: bigint; name: string }>
    >`
      SELECT DISTINCT b.id, b.name
      FROM branches b
      INNER JOIN user_branch_scopes scope ON scope.branch_id = b.id
      WHERE scope.user_id = ${userId} AND b.status = 'ACTIVE'
      ORDER BY b.name
    `;

    return NextResponse.json({
      rooms: rooms.map((row) => ({
        id: row.id.toString(),
        branchId: row.branch_id.toString(),
        branchName: row.branch_name,
        code: row.code,
        name: row.name,
        capacity: row.capacity,
        status: row.status,
      })),
      branches: branches.map((row) => ({
        id: row.id.toString(),
        name: row.name,
      })),
    });
  } catch (error) {
    console.error("GET ROOMS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách phòng học." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("CLASS_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = BigInt(auth.session.userId);

    const branchText = String(body.branchId ?? "");

    if (!/^\d+$/.test(branchText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn chi nhánh." },
        { status: 400 },
      );
    }

    const code = readText(body.code, 50);
    const name = readText(body.name, 100);
    const capacity = Number(body.capacity);

    if (!code) {
      return NextResponse.json(
        { error: "Vui lòng nhập mã phòng (tối đa 50 ký tự)." },
        { status: 400 },
      );
    }

    if (name === undefined) {
      return NextResponse.json(
        { error: "Tên phòng tối đa 100 ký tự." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return NextResponse.json(
        { error: "Sức chứa phải là số nguyên từ 1 đến 500." },
        { status: 400 },
      );
    }

    const branchId = BigInt(branchText);

    const allowed = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT b.id
      FROM branches b
      INNER JOIN user_branch_scopes scope ON scope.branch_id = b.id
      WHERE b.id = ${branchId} AND b.status = 'ACTIVE' AND scope.user_id = ${userId}
      LIMIT 1
    `;

    if (allowed.length === 0) {
      return NextResponse.json(
        { error: "Bạn không có quyền thêm phòng ở chi nhánh này." },
        { status: 403 },
      );
    }

    const duplicates = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM rooms WHERE branch_id = ${branchId} AND code = ${code} LIMIT 1
    `;

    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: "Mã phòng đã tồn tại trong chi nhánh này." },
        { status: 409 },
      );
    }

    await prisma.$executeRaw`
      INSERT INTO rooms (branch_id, code, name, status, capacity)
      VALUES (${branchId}, ${code}, ${name}, ${"ACTIVE"}, ${capacity})
    `;

    return NextResponse.json(
      { success: true, message: `Đã thêm phòng ${code}.` },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    return NextResponse.json(
      { error: "Không thể thêm phòng học." },
      { status: 500 },
    );
  }
}
