import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

export type AccessibleClass = {
  id: bigint;
  branch_id: bigint;
  code: string;
  name: string;
  status: string;
  course_offering_id: bigint;
  room_id: bigint | null;
};

// Giáo viên (role TEACHER) chỉ thấy lớp mình được phân công.
export function isTeacherOnly(session: SessionPayload): boolean {
  return session.role === "TEACHER";
}

// Lấy lớp nếu người dùng có quyền xem (đúng chi nhánh, và giáo viên thì đúng lớp của mình).
export async function findAccessibleClass(
  session: SessionPayload,
  classId: bigint,
): Promise<AccessibleClass | null> {
  const userId = BigInt(session.userId);
  const teacherOnly = isTeacherOnly(session) ? 1 : 0;

  const rows = await prisma.$queryRaw<AccessibleClass[]>`
    SELECT c.id, c.branch_id, c.code, c.name, c.status, c.course_offering_id, c.room_id
    FROM classes c
    WHERE c.id = ${classId}
      AND EXISTS (
        SELECT 1 FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId} AND scope.branch_id = c.branch_id
      )
      AND (
        ${teacherOnly} = 0
        OR EXISTS (
          SELECT 1
          FROM teacher_assignments ta
          INNER JOIN teachers t ON t.id = ta.teacher_id
          WHERE ta.class_id = c.id AND t.user_id = ${userId}
        )
      )
    LIMIT 1
  `;

  return rows.length > 0 ? rows[0] : null;
}
