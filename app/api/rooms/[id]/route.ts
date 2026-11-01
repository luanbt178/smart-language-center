import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { readText } from "@/lib/students";

type Params = { params: Promise<{ id: string }> };

const ROOM_STATUSES = ["ACTIVE", "INACTIVE"];

/**
 * PATCH /api/rooms/:id
 * Body (gửi trường nào sửa trường đó): { name, capacity, status: "ACTIVE" | "INACTIVE" }
 * - Không hạ sức chứa xuống thấp hơn số học viên của lớp đang mở dùng phòng này.
 * - Không ẩn (INACTIVE) phòng đang được lớp đang mở sử dụng.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission("CLASS_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID phòng không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const roomId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const rooms = await prisma.$queryRaw<
      Array<{ id: bigint; code: string; name: string | null; capacity: number; status: string }>
    >`
      SELECT r.id, r.code, r.name, r.capacity, r.status
      FROM rooms r
      WHERE r.id = ${roomId}
        AND EXISTS (
          SELECT 1 FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId} AND scope.branch_id = r.branch_id
        )
      LIMIT 1
    `;

    if (rooms.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy phòng hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const room = rooms[0];

    let name = room.name;
    let capacity = room.capacity;
    let status = room.status;

    if (body.name !== undefined) {
      const parsed = readText(body.name, 100);

      if (parsed === undefined) {
        return NextResponse.json(
          { error: "Tên phòng tối đa 100 ký tự." },
          { status: 400 },
        );
      }

      name = parsed;
    }

    if (body.capacity !== undefined) {
      const value = Number(body.capacity);

      if (!Number.isInteger(value) || value < 1 || value > 500) {
        return NextResponse.json(
          { error: "Sức chứa phải là số nguyên từ 1 đến 500." },
          { status: 400 },
        );
      }

      capacity = value;
    }

    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !ROOM_STATUSES.includes(body.status)
      ) {
        return NextResponse.json(
          { error: "Trạng thái phòng không hợp lệ." },
          { status: 400 },
        );
      }

      status = body.status;
    }

    if (capacity < room.capacity) {
      const usage = await prisma.$queryRaw<Array<{ max_students: bigint | number | null }>>`
        SELECT MAX(x.cnt) AS max_students
        FROM (
          SELECT COUNT(e.id) AS cnt
          FROM classes c
          LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'ACTIVE'
          WHERE c.room_id = ${roomId} AND c.status = 'ACTIVE'
          GROUP BY c.id
        ) x
      `;

      const maxStudents = Number(usage[0]?.max_students ?? 0);

      if (capacity < maxStudents) {
        return NextResponse.json(
          {
            error: `Sức chứa không được nhỏ hơn ${maxStudents} (số học viên của lớp đang dùng phòng này).`,
          },
          { status: 409 },
        );
      }
    }

    if (status === "INACTIVE" && room.status !== "INACTIVE") {
      const inUse = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM classes
        WHERE room_id = ${roomId} AND status = 'ACTIVE'
      `;

      if (Number(inUse[0].total) > 0) {
        return NextResponse.json(
          {
            error:
              "Phòng đang được lớp đang mở sử dụng, không thể ẩn. Hãy đóng lớp trước.",
          },
          { status: 409 },
        );
      }
    }

    await prisma.$executeRaw`
      UPDATE rooms
      SET name = ${name}, capacity = ${capacity}, status = ${status}
      WHERE id = ${roomId}
    `;

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật phòng ${room.code}.`,
    });
  } catch (error) {
    console.error("UPDATE ROOM ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật phòng học." },
      { status: 500 },
    );
  }
}
