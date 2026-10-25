import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/classes/:id/students
 * Body: { enrollmentId, action: "add" | "remove" }
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission("CLASS_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const enrollmentText = String(body.enrollmentId ?? "");
    const action = body.action;

    if (!/^\d+$/.test(id) || !/^\d+$/.test(enrollmentText)) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ." },
        { status: 400 },
      );
    }

    if (action !== "add" && action !== "remove") {
      return NextResponse.json(
        { error: "Thao tác không hợp lệ." },
        { status: 400 },
      );
    }

    const classId = BigInt(id);
    const enrollmentId = BigInt(enrollmentText);

    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Khóa dòng lớp để 2 người xếp cùng lúc không vượt sức chứa.
      const classes = await tx.$queryRaw<
        Array<{ status: string; capacity: number | null }>
      >`
        SELECT c.status, r.capacity
        FROM classes c
        LEFT JOIN rooms r ON r.id = c.room_id
        WHERE c.id = ${classId}
        LIMIT 1
        FOR UPDATE
      `;

      const klass = classes[0];

      const enrollments = await tx.$queryRaw<
        Array<{ id: bigint; status: string; class_id: bigint | null; course_offering_id: bigint }>
      >`
        SELECT id, status, class_id, course_offering_id
        FROM enrollments
        WHERE id = ${enrollmentId}
        LIMIT 1
        FOR UPDATE
      `;

      if (enrollments.length === 0) {
        throw new ApiError("Không tìm thấy ghi danh.", 404);
      }

      const enrollment = enrollments[0];

      if (action === "remove") {
        if (enrollment.class_id === null || enrollment.class_id !== classId) {
          throw new ApiError("Học viên không thuộc lớp này.");
        }

        await tx.$executeRaw`
          UPDATE enrollments SET class_id = NULL, updated_at = NOW()
          WHERE id = ${enrollmentId}
        `;

        return;
      }

      if (klass.status !== "ACTIVE") {
        throw new ApiError("Lớp đã đóng, không thể xếp thêm học viên.");
      }

      if (enrollment.status !== "ACTIVE") {
        throw new ApiError("Ghi danh đã bị hủy.");
      }

      if (enrollment.course_offering_id !== found.course_offering_id) {
        throw new ApiError("Học viên ghi danh khóa khác với lớp này.");
      }

      if (enrollment.class_id !== null) {
        throw new ApiError("Học viên đã được xếp vào một lớp.", 409);
      }

      if (klass.capacity !== null) {
        const counts = await tx.$queryRaw<Array<{ total: bigint | number }>>`
          SELECT COUNT(*) AS total
          FROM enrollments
          WHERE class_id = ${classId} AND status = 'ACTIVE'
        `;

        if (Number(counts[0].total) >= klass.capacity) {
          throw new ApiError(
            `Phòng chỉ chứa ${klass.capacity} học viên, lớp đã đầy.`,
            409,
          );
        }
      }

      await tx.$executeRaw`
        UPDATE enrollments SET class_id = ${classId}, updated_at = NOW()
        WHERE id = ${enrollmentId}
      `;
    });

    return NextResponse.json({
      success: true,
      message: action === "add" ? "Đã xếp học viên vào lớp." : "Đã bỏ học viên khỏi lớp.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CLASS STUDENTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật danh sách lớp." },
      { status: 500 },
    );
  }
}
