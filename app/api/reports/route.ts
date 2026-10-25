import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { todayVN } from "@/lib/dates";

type Total = { total: bigint | number | string | null };

function num(value: bigint | number | string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * GET /api/reports
 * Số liệu tổng hợp trong phạm vi chi nhánh của người xem.
 */
export async function GET() {
  const auth = await requireApiPermission("REPORT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);
    const today = todayVN();
    const monthStart = `${today.slice(0, 7)}-01 00:00:00`;

    // Mốc 5 tháng trước tháng hiện tại (đủ 6 tháng gồm tháng này).
    const base = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
    base.setUTCMonth(base.getUTCMonth() - 5);
    const sixMonthsStart = `${base.toISOString().slice(0, 7)}-01 00:00:00`;

    const students = await prisma.$queryRaw<Total[]>`
      SELECT COUNT(*) AS total FROM students s
      WHERE s.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = s.branch_id)
    `;

    const enrollments = await prisma.$queryRaw<Total[]>`
      SELECT COUNT(*) AS total
      FROM enrollments e
      INNER JOIN course_offerings o ON o.id = e.course_offering_id
      WHERE e.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = o.branch_id)
    `;

    const classes = await prisma.$queryRaw<Total[]>`
      SELECT COUNT(*) AS total FROM classes c
      WHERE c.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = c.branch_id)
    `;

    const leads = await prisma.$queryRaw<
      Array<{ status: string; total: bigint | number }>
    >`
      SELECT l.status, COUNT(*) AS total FROM leads l
      WHERE EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = l.branch_id)
      GROUP BY l.status
    `;

    const billed = await prisma.$queryRaw<Total[]>`
      SELECT CAST(COALESCE(SUM(i.amount), 0) AS CHAR) AS total FROM invoices i
      WHERE i.status <> 'CANCELLED'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = i.branch_id)
    `;

    const collected = await prisma.$queryRaw<Total[]>`
      SELECT CAST(COALESCE(SUM(p.amount), 0) AS CHAR) AS total FROM payments p
      WHERE p.status = 'COMPLETED'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = p.branch_id)
    `;

    const collectedMonth = await prisma.$queryRaw<Total[]>`
      SELECT CAST(COALESCE(SUM(p.amount), 0) AS CHAR) AS total FROM payments p
      WHERE p.status = 'COMPLETED'
        AND p.paid_at >= ${monthStart}
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = p.branch_id)
    `;

    const outstanding = await prisma.$queryRaw<Total[]>`
      SELECT CAST(COALESCE(SUM(r.remaining_amount), 0) AS CHAR) AS total
      FROM receivables r
      INNER JOIN invoices i ON i.id = r.invoice_id
      WHERE i.status <> 'CANCELLED'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = i.branch_id)
    `;

    const overdue = await prisma.$queryRaw<Total[]>`
      SELECT CAST(COALESCE(SUM(r.remaining_amount), 0) AS CHAR) AS total
      FROM receivables r
      INNER JOIN invoices i ON i.id = r.invoice_id
      WHERE i.status IN ('ISSUED', 'PARTIAL')
        AND i.due_date IS NOT NULL
        AND i.due_date < ${today}
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = i.branch_id)
    `;

    const monthly = await prisma.$queryRaw<
      Array<{ ym: string; total: string }>
    >`
      SELECT DATE_FORMAT(p.paid_at, '%Y-%m') AS ym,
             CAST(SUM(p.amount) AS CHAR) AS total
      FROM payments p
      WHERE p.status = 'COMPLETED'
        AND p.paid_at >= ${sixMonthsStart}
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = p.branch_id)
      GROUP BY ym
      ORDER BY ym
    `;

    const attendance = await prisma.$queryRaw<
      Array<{ status: string; total: bigint | number }>
    >`
      SELECT ar.status, COUNT(*) AS total
      FROM attendance_records ar
      INNER JOIN class_sessions cs ON cs.id = ar.session_id
      INNER JOIN classes c ON c.id = cs.class_id
      WHERE EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = c.branch_id)
      GROUP BY ar.status
    `;

    const byCourse = await prisma.$queryRaw<
      Array<{ course_name: string; total: bigint | number }>
    >`
      SELECT co.name AS course_name, COUNT(*) AS total
      FROM enrollments e
      INNER JOIN course_offerings o ON o.id = e.course_offering_id
      INNER JOIN course_versions cv ON cv.id = e.course_version_id
      INNER JOIN courses co ON co.id = cv.course_id
      WHERE e.status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM user_branch_scopes sc WHERE sc.user_id = ${userId} AND sc.branch_id = o.branch_id)
      GROUP BY co.id, co.name
      ORDER BY total DESC
      LIMIT 8
    `;

    // Đủ 6 tháng, tháng nào không có thu thì bằng 0.
    const months: Array<{ month: string; total: number }> = [];
    const cursor = new Date(base.getTime());

    for (let i = 0; i < 6; i += 1) {
      const key = cursor.toISOString().slice(0, 7);
      const found = monthly.find((m) => m.ym === key);

      months.push({ month: key, total: found ? Number(found.total) : 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const toMap = (rows: Array<{ status: string; total: bigint | number }>) => {
      const map: Record<string, number> = {};

      for (const row of rows) {
        map[row.status] = Number(row.total);
      }

      return map;
    };

    return NextResponse.json({
      generatedAt: today,
      counts: {
        students: num(students[0].total),
        enrollments: num(enrollments[0].total),
        classes: num(classes[0].total),
      },
      leads: toMap(leads),
      revenue: {
        billed: num(billed[0].total),
        collected: num(collected[0].total),
        collectedThisMonth: num(collectedMonth[0].total),
        outstanding: num(outstanding[0].total),
        overdue: num(overdue[0].total),
        monthly: months,
      },
      attendance: toMap(attendance),
      byCourse: byCourse.map((row) => ({
        courseName: row.course_name,
        total: Number(row.total),
      })),
    });
  } catch (error) {
    console.error("GET REPORTS ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải báo cáo." },
      { status: 500 },
    );
  }
}
