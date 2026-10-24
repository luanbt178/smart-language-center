import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { validDateTime } from "@/lib/placement";

type TestRow = {
  id: bigint;
  lead_id: bigint | null;
  test_date: string;
  status: string;
  lead_name: string | null;
  lead_phone: string | null;
  branch_code: string;
  branch_name: string;
  listening_score: string | null;
  speaking_score: string | null;
  reading_score: string | null;
  writing_score: string | null;
  total_score: string | null;
  recommended_level_id: bigint | null;
  level_code: string | null;
  level_name: string | null;
  created_by_name: string | null;
};

type LeadOptionRow = {
  id: bigint;
  full_name: string;
  phone: string | null;
  status: string;
  branch_code: string;
};

type LevelRow = {
  id: bigint;
  code: string;
  name: string;
};

export async function GET() {
  const auth = await requireApiPermission("PLACEMENT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const userId = BigInt(auth.session.userId);

    const tests = await prisma.$queryRaw<TestRow[]>`
      SELECT
        t.id,
        t.lead_id,
        DATE_FORMAT(t.test_date, '%Y-%m-%dT%H:%i') AS test_date,
        t.status,
        l.full_name AS lead_name,
        l.phone AS lead_phone,
        b.code AS branch_code,
        b.name AS branch_name,
        CAST(r.listening_score AS CHAR) AS listening_score,
        CAST(r.speaking_score AS CHAR) AS speaking_score,
        CAST(r.reading_score AS CHAR) AS reading_score,
        CAST(r.writing_score AS CHAR) AS writing_score,
        CAST(r.total_score AS CHAR) AS total_score,
        r.recommended_level_id,
        lv.code AS level_code,
        lv.name AS level_name,
        cu.full_name AS created_by_name
      FROM placement_tests t
      INNER JOIN branches b ON b.id = t.branch_id
      LEFT JOIN leads l ON l.id = t.lead_id
      LEFT JOIN placement_results r ON r.placement_test_id = t.id
      LEFT JOIN levels lv ON lv.id = r.recommended_level_id
      LEFT JOIN users cu ON cu.id = t.created_by
      WHERE EXISTS (
        SELECT 1
        FROM user_branch_scopes scope
        WHERE scope.user_id = ${userId}
          AND scope.branch_id = t.branch_id
      )
      ORDER BY t.test_date DESC, t.id DESC
    `;

    // Khách hàng có thể đặt lịch kiểm tra.
    const leads = await prisma.$queryRaw<LeadOptionRow[]>`
      SELECT
        l.id,
        l.full_name,
        l.phone,
        l.status,
        b.code AS branch_code
      FROM leads l
      INNER JOIN branches b ON b.id = l.branch_id
      WHERE l.status IN ('NEW', 'CONTACTED', 'QUALIFIED')
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = l.branch_id
        )
      ORDER BY l.full_name
    `;

    const levels = await prisma.$queryRaw<LevelRow[]>`
      SELECT id, code, name
      FROM levels
      ORDER BY code
    `;

    return NextResponse.json({
      tests: tests.map((row) => ({
        id: row.id.toString(),
        leadId: row.lead_id?.toString() ?? null,
        leadName: row.lead_name,
        leadPhone: row.lead_phone,
        branchCode: row.branch_code,
        branchName: row.branch_name,
        testDate: row.test_date,
        status: row.status,
        listening: row.listening_score,
        speaking: row.speaking_score,
        reading: row.reading_score,
        writing: row.writing_score,
        total: row.total_score,
        recommendedLevelId:
          row.recommended_level_id?.toString() ?? null,
        levelCode: row.level_code,
        levelName: row.level_name,
        createdByName: row.created_by_name,
      })),

      leads: leads.map((row) => ({
        id: row.id.toString(),
        fullName: row.full_name,
        phone: row.phone,
        status: row.status,
        branchCode: row.branch_code,
      })),

      levels: levels.map((row) => ({
        id: row.id.toString(),
        code: row.code,
        name: row.name,
      })),
    });
  } catch (error) {
    console.error("GET PLACEMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải danh sách kiểm tra đầu vào." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("PLACEMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const leadIdText = String(body.leadId ?? "");
    const testDate = body.testDate;

    if (!/^\d+$/.test(leadIdText)) {
      return NextResponse.json(
        { error: "Vui lòng chọn khách hàng." },
        { status: 400 },
      );
    }

    if (!validDateTime(testDate)) {
      return NextResponse.json(
        { error: "Ngày giờ kiểm tra không hợp lệ." },
        { status: 400 },
      );
    }

    const leadId = BigInt(leadIdText);
    const userId = BigInt(auth.session.userId);

    // Khách hàng phải thuộc chi nhánh người dùng được phép.
    const leads = await prisma.$queryRaw<
      Array<{ id: bigint; branch_id: bigint; status: string }>
    >`
      SELECT l.id, l.branch_id, l.status
      FROM leads l
      WHERE l.id = ${leadId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = l.branch_id
        )
      LIMIT 1
    `;

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy khách hàng hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const lead = leads[0];

    if (lead.status === "LOST" || lead.status === "CONVERTED") {
      return NextResponse.json(
        {
          error:
            "Không thể đặt lịch cho khách hàng đã dừng hoặc đã chuyển đổi.",
        },
        { status: 400 },
      );
    }

    const pending = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM placement_tests
      WHERE lead_id = ${leadId}
        AND status = 'SCHEDULED'
      LIMIT 1
    `;

    if (pending.length > 0) {
      return NextResponse.json(
        {
          error:
            "Khách hàng này đang có một lịch kiểm tra chưa thi.",
        },
        { status: 409 },
      );
    }

    const testDateSql = `${testDate.replace("T", " ")}:00`;

    const createdId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO placement_tests (
          branch_id,
          lead_id,
          test_date,
          created_by,
          status
        )
        VALUES (
          ${lead.branch_id},
          ${leadId},
          ${testDateSql},
          ${userId},
          ${"SCHEDULED"}
        )
      `;

      const ids = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT LAST_INSERT_ID() AS id
      `;

      return ids[0].id;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Đã đặt lịch kiểm tra đầu vào.",
        id: createdId.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE PLACEMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể đặt lịch kiểm tra." },
      { status: 500 },
    );
  }
}