import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function clean(value: unknown, max: number): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length > max) return false;
  return v === "" ? null : v;
}

/** Kiểm tra học viên tồn tại và người dùng có quyền với chi nhánh của học viên. */
async function findStudentBranch(studentId: bigint, userId: bigint) {
  const rows = await prisma.$queryRaw<Array<{ branch_id: bigint }>>`
    SELECT s.branch_id
    FROM students s
    WHERE s.id = ${studentId}
      AND EXISTS (
        SELECT 1 FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId} AND scope.branch_id = s.branch_id
      )
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].branch_id : null;
}

/** POST /api/students/{id}/guardians - thêm phụ huynh cho học viên. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("STUDENT_UPDATE");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) return fail("ID học viên không hợp lệ.");

    const studentId = BigInt(id);
    const userId = BigInt(auth.session.userId);
    const body = (await request.json()) as Record<string, unknown>;

    const fullName = clean(body.fullName, 150);
    const phone = clean(body.phone, 30);
    const email = clean(body.email, 150);
    const address = clean(body.address, 255);
    const relationship = clean(body.relationship, 50);
    const isPrimary = body.isPrimary === true;

    if (!fullName) return fail("Họ tên phụ huynh là bắt buộc (tối đa 150 ký tự).");
    if (phone === false || email === false || address === false || relationship === false) {
      return fail("Thông tin phụ huynh quá dài hoặc không hợp lệ.");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Email phụ huynh không hợp lệ.");
    }

    const branchId = await findStudentBranch(studentId, userId);
    if (branchId === null) return fail("Không tìm thấy học viên.", 404);

    const linkId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO guardians (full_name, email, phone, address, created_at)
        VALUES (${fullName}, ${email}, ${phone}, ${address}, NOW())
      `;
      const g = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT LAST_INSERT_ID() AS id`;
      const guardianId = g[0].id;

      if (isPrimary) {
        await tx.$executeRaw`
          UPDATE student_guardians SET is_primary = 0 WHERE student_id = ${studentId}
        `;
      }

      await tx.$executeRaw`
        INSERT INTO student_guardians (guardian_id, student_id, relationship, is_primary)
        VALUES (${guardianId}, ${studentId}, ${relationship}, ${isPrimary ? 1 : 0})
      `;
      const l = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT LAST_INSERT_ID() AS id`;
      return l[0].id;
    });

    await writeAudit({
      userId,
      branchId,
      action: "GUARDIAN_ADD",
      entityType: "student_guardians",
      entityId: linkId,
      newData: { studentId: id, fullName, relationship, isPrimary },
    });

    return NextResponse.json(
      { success: true, message: "Đã thêm phụ huynh.", linkId: linkId.toString() },
      { status: 201 },
    );
  } catch (error) {
    console.error("ADD GUARDIAN ERROR:", error);
    return fail("Không thể thêm phụ huynh.", 500);
  }
}

/** DELETE /api/students/{id}/guardians?linkId=... - gỡ liên kết phụ huynh. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("STUDENT_UPDATE");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const linkIdText = new URL(request.url).searchParams.get("linkId") ?? "";

    if (!/^\d+$/.test(id) || !/^\d+$/.test(linkIdText)) {
      return fail("Tham số không hợp lệ.");
    }

    const studentId = BigInt(id);
    const linkId = BigInt(linkIdText);
    const userId = BigInt(auth.session.userId);

    const branchId = await findStudentBranch(studentId, userId);
    if (branchId === null) return fail("Không tìm thấy học viên.", 404);

    const old = await prisma.$queryRaw<
      Array<{ guardian_id: bigint; relationship: string | null }>
    >`
      SELECT guardian_id, relationship
      FROM student_guardians
      WHERE id = ${linkId} AND student_id = ${studentId}
      LIMIT 1
    `;
    if (old.length === 0) return fail("Không tìm thấy liên kết phụ huynh.", 404);

    // Chỉ gỡ liên kết. Hồ sơ phụ huynh được giữ lại vì có thể gắn tài khoản cổng thông tin.
    await prisma.$executeRaw`
      DELETE FROM student_guardians WHERE id = ${linkId} AND student_id = ${studentId}
    `;

    await writeAudit({
      userId,
      branchId,
      action: "GUARDIAN_REMOVE",
      entityType: "student_guardians",
      entityId: linkId,
      oldData: {
        studentId: id,
        guardianId: old[0].guardian_id.toString(),
        relationship: old[0].relationship,
      },
    });

    return NextResponse.json({ success: true, message: "Đã gỡ phụ huynh." });
  } catch (error) {
    console.error("REMOVE GUARDIAN ERROR:", error);
    return fail("Không thể gỡ phụ huynh.", 500);
  }
}