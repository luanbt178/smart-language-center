import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { makeTeacherCode } from "@/lib/classes";

type TeacherRow = {
  id: bigint;
  teacher_code: string;
  full_name: string;
  phone: string | null;
  email: string;
  employment_status: string | null;
};

type CandidateRow = {
  id: bigint;
  username: string;
  full_name: string;
  email: string | null;
};

// Giáo viên thuộc phạm vi xem được: tài khoản của họ chung chi nhánh với người xem.
export async function GET() {
  const auth = await requireApiPermission("CLASS_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const teachers = await prisma.$queryRaw<TeacherRow[]>`
      SELECT t.id, t.teacher_code, t.full_name, t.phone, t.email, t.employment_status
      FROM teachers t
      WHERE EXISTS (
        SELECT 1
        FROM user_branch_scopes mine
        INNER JOIN user_branch_scopes theirs ON theirs.branch_id = mine.branch_id
        WHERE mine.user_id = ${userId} AND theirs.user_id = t.user_id
      )
      ORDER BY t.full_name
    `;

    let candidates: CandidateRow[] = [];

    if (auth.session.permissions.includes("CLASS_CREATE")) {
      candidates = await prisma.$queryRaw<CandidateRow[]>`
        SELECT u.id, u.username, u.full_name, u.email
        FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.id
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE r.code = 'TEACHER'
          AND u.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = u.id)
          AND EXISTS (
            SELECT 1
            FROM user_branch_scopes mine
            INNER JOIN user_branch_scopes theirs ON theirs.branch_id = mine.branch_id
            WHERE mine.user_id = ${userId} AND theirs.user_id = u.id
          )
        ORDER BY u.full_name
      `;
    }

    return NextResponse.json({
      teachers: teachers.map((row) => ({
        id: row.id.toString(),
        teacherCode: row.teacher_code,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        employmentStatus: row.employment_status,
      })),
      candidates: candidates.map((row) => ({
        id: row.id.toString(),
        username: row.username,
        fullName: row.full_name,
        email: row.email,
      })),
    });
  } catch (error) {
    console.error("GET TEACHERS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách giáo viên." },
      { status: 500 },
    );
  }
}

// Tạo hồ sơ giáo viên từ tài khoản có role TEACHER.
export async function POST(request: Request) {
  const auth = await requireApiPermission("CLASS_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const actorId = BigInt(auth.session.userId);

    const userText = String(body.userId ?? "");

    if (!/^\d+$/.test(userText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn tài khoản giáo viên." },
        { status: 400 },
      );
    }

    const targetId = BigInt(userText);

    const users = await prisma.$queryRaw<CandidateRow[]>`
      SELECT u.id, u.username, u.full_name, u.email
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.id = ${targetId}
        AND r.code = 'TEACHER'
        AND u.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = u.id)
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes mine
          INNER JOIN user_branch_scopes theirs ON theirs.branch_id = mine.branch_id
          WHERE mine.user_id = ${actorId} AND theirs.user_id = u.id
        )
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tài khoản không hợp lệ, đã có hồ sơ giáo viên hoặc ngoài phạm vi của bạn.",
        },
        { status: 400 },
      );
    }

    const user = users[0];

    if (!user.email) {
      return NextResponse.json(
        {
          error:
            "Tài khoản này chưa có email. Hãy bổ sung email trước khi tạo hồ sơ giáo viên.",
        },
        { status: 400 },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const tempCode = `TMP-${randomUUID()}`;

      await tx.$executeRaw`
        INSERT INTO teachers (user_id, teacher_code, full_name, phone, email, employment_status, created_at)
        VALUES (${user.id}, ${tempCode}, ${user.full_name}, NULL, ${user.email}, ${"ACTIVE"}, NOW())
      `;

      const ids = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      const teacherCode = makeTeacherCode(ids[0].id);

      await tx.$executeRaw`
        UPDATE teachers SET teacher_code = ${teacherCode} WHERE id = ${ids[0].id}
      `;

      return teacherCode;
    });

    return NextResponse.json(
      { success: true, message: `Đã tạo hồ sơ giáo viên ${created}.` },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE TEACHER ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tạo hồ sơ giáo viên." },
      { status: 500 },
    );
  }
}
