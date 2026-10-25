import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";

class EnrollmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * PATCH /api/enrollments/:id
 * Hủy ghi danh (chỉ khi chưa có khoản thanh toán nào).
 * Body: { status: "CANCELLED", reason: "..." }
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("ENROLLMENT_UPDATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID ghi danh không hợp lệ." },
        { status: 400 },
      );
    }

    const enrollmentId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const body = (await request.json()) as Record<string, unknown>;

    if (body.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Hiện chỉ hỗ trợ hủy ghi danh." },
        { status: 400 },
      );
    }

    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    if (reason === "" || reason.length > 500) {
      return NextResponse.json(
        { error: "Vui lòng nhập lý do hủy (tối đa 500 ký tự)." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: bigint; status: string }>
      >`
        SELECT e.id, e.status
        FROM enrollments e
        INNER JOIN course_offerings o ON o.id = e.course_offering_id
        WHERE e.id = ${enrollmentId}
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId}
              AND scope.branch_id = o.branch_id
          )
        LIMIT 1
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new EnrollmentError(
          "Không tìm thấy ghi danh hoặc bạn không có quyền.",
          404,
        );
      }

      if (rows[0].status !== "ACTIVE") {
        throw new EnrollmentError("Ghi danh này đã được hủy trước đó.");
      }

      const payments = await tx.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*) AS total
        FROM payments p
        INNER JOIN invoices i ON i.id = p.invoice_id
        WHERE i.enrollment_id = ${enrollmentId}
          AND p.status = 'COMPLETED'
      `;

      if (Number(payments[0].total) > 0) {
        throw new EnrollmentError(
          "Ghi danh đã có thanh toán, không thể hủy trực tiếp. Cần xử lý hoàn tiền trước.",
          409,
        );
      }

      await tx.$executeRaw`
        UPDATE enrollments
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE id = ${enrollmentId}
      `;

      await tx.$executeRaw`
        INSERT INTO enrollment_status_history (
          enrollment_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          reason
        )
        VALUES (
          ${enrollmentId},
          ${"ACTIVE"},
          ${"CANCELLED"},
          ${userId},
          NOW(),
          ${reason}
        )
      `;

      await tx.$executeRaw`
        UPDATE invoices
        SET status = 'CANCELLED'
        WHERE enrollment_id = ${enrollmentId}
      `;

      await tx.$executeRaw`
        UPDATE receivables r
        INNER JOIN invoices i ON i.id = r.invoice_id
        SET r.status = 'CANCELLED',
            r.remaining_amount = 0,
            r.updated_at = NOW()
        WHERE i.enrollment_id = ${enrollmentId}
      `;
    });

    return NextResponse.json({
      success: true,
      message: "Đã hủy ghi danh và hủy hóa đơn.",
    });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("CANCEL ENROLLMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể hủy ghi danh." },
      { status: 500 },
    );
  }
}
