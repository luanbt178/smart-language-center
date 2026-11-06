import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"];

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * PATCH /api/catalog/{entity}/{id}
 * entity: programVersion | courseVersion | offering
 * Client luôn gửi đủ các trường của entity (giá trị cũ nếu không đổi).
 * Tạm dùng quyền COURSE_CREATE vì hệ thống chưa có COURSE_UPDATE.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const auth = await requireApiPermission("COURSE_CREATE");
  if (!auth.ok) return auth.response;

  try {
    const { entity, id } = await params;
    if (!/^\d+$/.test(id)) return fail("ID không hợp lệ.");

    const rowId = BigInt(id);
    const userId = BigInt(auth.session.userId);
    const body = (await request.json()) as Record<string, unknown>;

    const status = typeof body.status === "string" ? body.status : "";
    if (!STATUSES.includes(status)) return fail("Trạng thái không hợp lệ.");

    const description =
      typeof body.description === "string" && body.description.trim() !== ""
        ? body.description.trim()
        : null;
    if (description && description.length > 10000) {
      return fail("Mô tả quá dài.");
    }

    // ---------------- Phiên bản chương trình ----------------
    if (entity === "programVersion") {
      const old = await prisma.$queryRaw<
        Array<{ status: string; description: string | null }>
      >`SELECT status, description FROM program_versions WHERE id = ${rowId} LIMIT 1`;
      if (old.length === 0) return fail("Không tìm thấy phiên bản chương trình.", 404);

      await prisma.$executeRaw`
        UPDATE program_versions
        SET status = ${status}, description = ${description}
        WHERE id = ${rowId}
      `;

      await writeAudit({
        userId,
        action: "CATALOG_UPDATE",
        entityType: "program_versions",
        entityId: rowId,
        oldData: old[0],
        newData: { status, description },
      });
    }

    // ---------------- Phiên bản khóa học ----------------
    else if (entity === "courseVersion") {
      const feeText = String(body.tuitionFee ?? "").trim();
      if (feeText !== "" && !/^\d{1,13}(\.\d{1,2})?$/.test(feeText)) {
        return fail("Học phí không hợp lệ.");
      }
      const tuitionFee = feeText === "" ? null : feeText;

      const old = await prisma.$queryRaw<
        Array<{ status: string; description: string | null; tuition_fee: string | null }>
      >`SELECT status, description, CAST(tuition_fee AS CHAR) AS tuition_fee
        FROM course_versions WHERE id = ${rowId} LIMIT 1`;
      if (old.length === 0) return fail("Không tìm thấy phiên bản khóa học.", 404);

      await prisma.$executeRaw`
        UPDATE course_versions
        SET status = ${status}, description = ${description}, tuition_fee = ${tuitionFee}
        WHERE id = ${rowId}
      `;

      await writeAudit({
        userId,
        action: "CATALOG_UPDATE",
        entityType: "course_versions",
        entityId: rowId,
        oldData: old[0],
        newData: { status, description, tuition_fee: tuitionFee },
      });
    }

    // ---------------- Đợt mở khóa học ----------------
    else if (entity === "offering") {
      const startDate = body.startDate;
      const endDate = body.endDate;
      const maxText = String(body.maxStudents ?? "").trim();

      if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
        return fail("Ngày bắt đầu/kết thúc không hợp lệ.");
      }
      if (
        maxText !== "" &&
        (!/^\d+$/.test(maxText) || Number(maxText) < 1 || Number(maxText) > 2147483647)
      ) {
        return fail("Sĩ số tối đa không hợp lệ.");
      }
      const maxStudents = maxText === "" ? null : Number(maxText);

      const old = await prisma.$queryRaw<
        Array<{
          branch_id: bigint;
          status: string;
          start_date: string;
          end_date: string;
          max_students: number | null;
        }>
      >`SELECT branch_id, status,
               DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
               DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
               max_students
        FROM course_offerings WHERE id = ${rowId} LIMIT 1`;
      if (old.length === 0) return fail("Không tìm thấy đợt mở khóa học.", 404);

      const scope = await prisma.$queryRaw<Array<{ id: bigint }>>`
        SELECT branch_id AS id FROM user_branch_scopes
        WHERE user_id = ${userId} AND branch_id = ${old[0].branch_id} LIMIT 1
      `;
      if (scope.length === 0) {
        return fail("Bạn không có quyền với chi nhánh của đợt này.", 403);
      }

      // Không cho giảm sĩ số tối đa xuống thấp hơn số ghi danh hiện có.
      if (maxStudents !== null) {
        const count = await prisma.$queryRaw<Array<{ total: bigint }>>`
          SELECT COUNT(*) AS total FROM enrollments
          WHERE course_offering_id = ${rowId}
        `;
        if (Number(count[0].total) > maxStudents) {
          return fail(
            `Đợt này đã có ${count[0].total} ghi danh, sĩ số tối đa không được nhỏ hơn.`,
          );
        }
      }

      await prisma.$executeRaw`
        UPDATE course_offerings
        SET status = ${status}, start_date = ${startDate}, end_date = ${endDate},
            max_students = ${maxStudents}
        WHERE id = ${rowId}
      `;

      await writeAudit({
        userId,
        branchId: old[0].branch_id,
        action: "CATALOG_UPDATE",
        entityType: "course_offerings",
        entityId: rowId,
        oldData: {
          status: old[0].status,
          start_date: old[0].start_date,
          end_date: old[0].end_date,
          max_students: old[0].max_students,
        },
        newData: { status, start_date: startDate, end_date: endDate, max_students: maxStudents },
      });
    } else {
      return fail("Loại danh mục không được hỗ trợ.");
    }

    return NextResponse.json({ success: true, message: "Cập nhật thành công." });
  } catch (error) {
    console.error("UPDATE CATALOG ERROR:", error);
    return fail("Không thể cập nhật danh mục.", 500);
  }
}