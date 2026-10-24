import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { parseScore } from "@/lib/placement";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireApiPermission("PLACEMENT_CREATE");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "ID bài kiểm tra không hợp lệ." },
        { status: 400 },
      );
    }

    const testId = BigInt(id);
    const userId = BigInt(auth.session.userId);

    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action !== "result" && action !== "cancel") {
      return NextResponse.json(
        { error: "Thao tác không hợp lệ." },
        { status: 400 },
      );
    }

    // Bài kiểm tra phải thuộc chi nhánh người dùng được phép.
    const tests = await prisma.$queryRaw<
      Array<{ id: bigint; status: string; lead_id: bigint | null }>
    >`
      SELECT t.id, t.status, t.lead_id
      FROM placement_tests t
      WHERE t.id = ${testId}
        AND EXISTS (
          SELECT 1
          FROM user_branch_scopes scope
          WHERE scope.user_id = ${userId}
            AND scope.branch_id = t.branch_id
        )
      LIMIT 1
    `;

    if (tests.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền." },
        { status: 404 },
      );
    }

    const test = tests[0];

    if (test.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Bài kiểm tra này đã bị hủy." },
        { status: 409 },
      );
    }

    // ---------- HỦY LỊCH ----------
    if (action === "cancel") {
      if (test.status !== "SCHEDULED") {
        return NextResponse.json(
          { error: "Chỉ hủy được lịch chưa thi." },
          { status: 409 },
        );
      }

      await prisma.$executeRaw`
        UPDATE placement_tests
        SET status = 'CANCELLED'
        WHERE id = ${testId}
      `;

      return NextResponse.json({
        success: true,
        message: "Đã hủy lịch kiểm tra.",
      });
    }

    // ---------- NHẬP KẾT QUẢ ----------
    const listening = parseScore(body.listening);
    const speaking = parseScore(body.speaking);
    const reading = parseScore(body.reading);
    const writing = parseScore(body.writing);

    if (
      listening === undefined ||
      speaking === undefined ||
      reading === undefined ||
      writing === undefined
    ) {
      return NextResponse.json(
        { error: "Điểm phải là số từ 0 đến 100 (tối đa 2 số lẻ)." },
        { status: 400 },
      );
    }

    if (reading === null || writing === null) {
      return NextResponse.json(
        { error: "Điểm Đọc và Viết là bắt buộc." },
        { status: 400 },
      );
    }

    const scores = [listening, speaking, reading, writing].filter(
      (value): value is number => value !== null,
    );

    const total =
      Math.round(
        (scores.reduce((sum, value) => sum + value, 0) /
          scores.length) *
          100,
      ) / 100;

    const levelIdText = String(body.recommendedLevelId ?? "").trim();

    if (levelIdText !== "" && !/^\d+$/.test(levelIdText)) {
      return NextResponse.json(
        { error: "Trình độ đề xuất không hợp lệ." },
        { status: 400 },
      );
    }

    let levelId: bigint | null = null;

    if (levelIdText !== "") {
      levelId = BigInt(levelIdText);

      const levels = await prisma.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM levels WHERE id = ${levelId} LIMIT 1
      `;

      if (levels.length === 0) {
        return NextResponse.json(
          { error: "Trình độ đề xuất không tồn tại." },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM placement_results
        WHERE placement_test_id = ${testId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        await tx.$executeRaw`
          UPDATE placement_results
          SET
            listening_score = ${listening},
            speaking_score = ${speaking},
            reading_score = ${reading},
            writing_score = ${writing},
            total_score = ${total},
            recommended_level_id = ${levelId},
            reviewed_by = ${userId},
            reviewed_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO placement_results (
            placement_test_id,
            listening_score,
            speaking_score,
            reading_score,
            writing_score,
            total_score,
            recommended_level_id,
            reviewed_by,
            reviewed_at
          )
          VALUES (
            ${testId},
            ${listening},
            ${speaking},
            ${reading},
            ${writing},
            ${total},
            ${levelId},
            ${userId},
            NOW()
          )
        `;
      }

      await tx.$executeRaw`
        UPDATE placement_tests
        SET status = 'COMPLETED'
        WHERE id = ${testId}
      `;

      // Khách hàng mới hoặc đã liên hệ -> tiềm năng phù hợp.
      if (test.lead_id !== null) {
        await tx.$executeRaw`
          UPDATE leads
          SET status = 'QUALIFIED'
          WHERE id = ${test.lead_id}
            AND status IN ('NEW', 'CONTACTED')
        `;
      }
    });

    return NextResponse.json({
      success: true,
      message: `Đã lưu kết quả. Điểm trung bình: ${total}.`,
    });
  } catch (error) {
    console.error("UPDATE PLACEMENT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể cập nhật bài kiểm tra." },
      { status: 500 },
    );
  }
}