import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { findAccessibleClass } from "@/lib/class-access";
import { ApiError } from "@/lib/api-error";

type Params = { params: Promise<{ id: string; sessionId: string }> };

/**
 * PATCH /api/classes/:id/sessions/:sessionId
 * Body: { status: "CANCELLED" }
 * Hủy một buổi học chưa diễn ra và chưa có điểm danh. Buổi đã hủy không còn
 * chiếm phòng và giáo viên (kiểm tra trùng lịch bỏ qua buổi CANCELLED).
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission("SCHEDULE_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id, sessionId } = await params;

    if (!/^\d+$/.test(id) || !/^\d+$/.test(sessionId)) {
      return NextResponse.json(
        { error: "ID không hợp lệ." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (body.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Hiện chỉ hỗ trợ hủy buổi học." },
        { status: 400 },
      );
    }

    const classId = BigInt(id);
    const sessionKey = BigInt(sessionId);

    const found = await findAccessibleClass(auth.session, classId);

    if (!found) {
      return NextResponse.json(
        { error: "Không tìm thấy lớp hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<
        Array<{ id: bigint; status: string }>
      >`
        SELECT id, status
        FROM class_sessions
        WHERE id = ${sessionKey} AND class_id = ${classId}
        LIMIT 1
        FOR UPDATE
      `;

      if (sessions.length === 0) {
        throw new ApiError("Không tìm thấy buổi học của lớp này.", 404);
      }

      if (sessions[0].status === "CANCELLED") {
        throw new ApiError("Buổi học này đã được hủy trước đó.");
      }

      if (sessions[0].status !== "SCHEDULED") {
        throw new ApiError("Chỉ hủy được buổi học chưa diễn ra.", 409);
      }

      const records = await tx.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM attendance_records
        WHERE session_id = ${sessionKey}
      `;

      if (Number(records[0].total) > 0) {
        throw new ApiError(
          "Buổi học đã có điểm danh, không thể hủy.",
          409,
        );
      }

      await tx.$executeRaw`
        UPDATE class_sessions SET status = 'CANCELLED' WHERE id = ${sessionKey}
      `;
    });

    return NextResponse.json({
      success: true,
      message: "Đã hủy buổi học.",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CANCEL SESSION ERROR:", error);

    return NextResponse.json(
      { error: "Không thể hủy buổi học." },
      { status: 500 },
    );
  }
}
