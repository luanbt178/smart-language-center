import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/permissions";
import { validDateOnly } from "@/lib/students";

type Row = {
  id: bigint;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: bigint;
  new_data: string | null;
  full_name: string | null;
  username: string | null;
};

// Rút gọn new_data (JSON) thành "ip" và chuỗi mô tả ngắn.
function summarize(raw: string | null): { ip: string | null; detail: string } {
  if (!raw) return { ip: null, detail: "" };

  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const ip = typeof data.ip === "string" ? data.ip : null;
    const detail = Object.entries(data)
      .filter(([key]) => key !== "ip")
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");

    return { ip, detail: detail.slice(0, 200) };
  } catch {
    return { ip: null, detail: raw.slice(0, 200) };
  }
}

// Nhật ký hệ thống: 200 dòng mới nhất theo bộ lọc.
export async function GET(request: Request) {
  const auth = await requireApiPermission("AUDIT_VIEW");

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const action = (url.searchParams.get("action") ?? "").trim().slice(0, 100);
    const fromParam = url.searchParams.get("from") ?? "";
    const toParam = url.searchParams.get("to") ?? "";

    if (
      (fromParam && !validDateOnly(fromParam)) ||
      (toParam && !validDateOnly(toParam))
    ) {
      return NextResponse.json(
        { error: "Ngày lọc không hợp lệ." },
        { status: 400 },
      );
    }

    const from = fromParam || "1970-01-01";
    const to = toParam || "2999-12-31";
    const userId = BigInt(auth.session.userId);

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        al.id,
        DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        al.action,
        al.entity_type,
        al.entity_id,
        al.new_data,
        u.full_name,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (
          al.branch_id IS NULL
          OR EXISTS (
            SELECT 1 FROM user_branch_scopes scope
            WHERE scope.user_id = ${userId} AND scope.branch_id = al.branch_id
          )
        )
        AND (${action} = '' OR al.action = ${action})
        AND al.created_at >= ${from}
        AND al.created_at < DATE_ADD(${to}, INTERVAL 1 DAY)
      ORDER BY al.id DESC
      LIMIT 200
    `;

    const actions = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT DISTINCT action FROM audit_logs ORDER BY action
    `;

    return NextResponse.json({
      logs: rows.map((row) => {
        const { ip, detail } = summarize(row.new_data);

        return {
          id: row.id.toString(),
          createdAt: row.created_at,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id.toString(),
          userName: row.full_name,
          username: row.username,
          ip,
          detail,
        };
      }),
      actions: actions.map((a) => a.action),
    });
  } catch (error) {
    console.error("GET AUDIT ERROR:", error);

    return NextResponse.json(
      { error: "Không thể tải nhật ký hệ thống." },
      { status: 500 },
    );
  }
}