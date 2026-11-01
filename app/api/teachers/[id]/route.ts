import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { readText } from "@/lib/students";

type Params = { params: Promise<{ id: string }> };

const EMPLOYMENT_STATUSES = ["ACTIVE", "INACTIVE"];
const PHONE_PATTERN = /^[0-9+().\-\s]{6,30}$/;

/**
 * PATCH /api/teachers/:id
 * Body (gửi trường nào sửa trường đó): { phone, employmentStatus: "ACTIVE" | "INACTIVE" }
 * Không cho ngừng (INACTIVE) giáo viên đang là giáo viên chính của lớp đang mở.
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
        { error: "ID giáo viên không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const teacherId = BigInt(id);
    const actorId = BigInt(auth.session.userId);

    const teachers = await prisma.$queryRaw<
      Array<{
        id: bigint;
        teacher_code: string;
        phone: string | null;
        employment_status: string | null;
      }>
    >`
      SELECT t.id, t.teacher_code, t.phone, t.employment_status
      FROM teachers t
      WHERE t.id = ${teacherId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes mine
          INNER JOIN user_branch_scopes theirs ON theirs.branch_id = mine.branch_id
          WHERE mine.user_id = ${actorId} AND theirs.user_id = t.user_id
        )
      LIMIT 1
    `;

    if (teachers.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy giáo viên hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const teacher = teachers[0];

    let phone = teacher.phone;
    let status = teacher.employment_status ?? "ACTIVE";

    if (body.phone !== undefined) {
      const parsed = readText(body.phone, 30);

      if (parsed === undefined || (parsed !== null && !PHONE_PATTERN.test(parsed))) {
        return NextResponse.json(
          { error: "Số điện thoại không hợp lệ (tối đa 30 ký tự)." },
          { status: 400 },
        );
      }

      phone = parsed;
    }

    if (body.employmentStatus !== undefined) {
      if (
        typeof body.employmentStatus !== "string" ||
        !EMPLOYMENT_STATUSES.includes(body.employmentStatus)
      ) {
        return NextResponse.json(
          { error: "Trạng thái giáo viên không hợp lệ." },
          { status: 400 },
        );
      }

      status = body.employmentStatus;
    }

    if (status === "INACTIVE" && teacher.employment_status !== "INACTIVE") {
      const inUse = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM teacher_assignments ta
        INNER JOIN classes c ON c.id = ta.class_id
        WHERE ta.teacher_id = ${teacherId}
          AND ta.role = 'MAIN'
          AND c.status = 'ACTIVE'
      `;

      if (Number(inUse[0].total) > 0) {
        return NextResponse.json(
          {
            error:
              "Giáo viên đang là giáo viên chính của lớp đang mở, không thể ngừng. Hãy đóng lớp hoặc đổi giáo viên trước.",
          },
          { status: 409 },
        );
      }
    }

    await prisma.$executeRaw`
      UPDATE teachers
      SET phone = ${phone}, employment_status = ${status}
      WHERE id = ${teacherId}
    `;

    await writeAudit({
      userId: auth.session.userId,
      action: "TEACHER_UPDATE",
      entityType: "teacher",
      entityId: teacherId,
      oldData: {
        phone: teacher.phone,
        employmentStatus: teacher.employment_status,
      },
      newData: { phone, employmentStatus: status },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật giáo viên ${teacher.teacher_code}.`,
    });
  } catch (error) {
    console.error("UPDATE TEACHER ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật giáo viên." },
      { status: 500 },
    );
  }
}
