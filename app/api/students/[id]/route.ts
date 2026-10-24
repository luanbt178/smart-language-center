import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { STUDENT_STATUSES, parseStudentInput } from "@/lib/students";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("STUDENT_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID học viên không hợp lệ." },
        { status: 400 },
      );
    }

    const studentId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const body = (await request.json()) as Record<string, unknown>;

    const status = typeof body.status === "string" ? body.status : "";

    if (!(STUDENT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái học viên không hợp lệ." },
        { status: 400 },
      );
    }

    const parsed = parseStudentInput(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const students = await prisma.$queryRaw<Array<{ branch_id: bigint }>>`
      SELECT s.branch_id
      FROM students s
      WHERE s.id = ${studentId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = s.branch_id
        )
      LIMIT 1
    `;

    if (students.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy học viên hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const branchId = students[0].branch_id;

    // Chặn trùng với học viên khác cùng chi nhánh.
    if (input.phone || input.email) {
      const duplicates = await prisma.$queryRaw<
        Array<{ student_code: string; full_name: string }>
      >`
        SELECT student_code, full_name
        FROM students
        WHERE branch_id = ${branchId}
          AND id <> ${studentId}
          AND (
            (${input.phone ?? ""} <> '' AND phone = ${input.phone ?? ""})
            OR (${input.email ?? ""} <> '' AND email = ${input.email ?? ""})
          )
        LIMIT 1
      `;

      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            error: `Trùng với học viên ${duplicates[0].full_name} (${duplicates[0].student_code}).`,
          },
          { status: 409 },
        );
      }
    }

    await prisma.$executeRaw`
      UPDATE students
      SET
        full_name = ${input.fullName},
        phone = ${input.phone},
        email = ${input.email},
        gender = ${input.gender},
        dob = ${input.dob},
        address = ${input.address},
        status = ${status}
      WHERE id = ${studentId}
        AND branch_id = ${branchId}
    `;

    return NextResponse.json({
      success: true,
      message: "Cập nhật học viên thành công.",
    });
  } catch (error) {
    console.error("UPDATE STUDENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật học viên." },
      { status: 500 },
    );
  }
}