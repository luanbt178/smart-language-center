import "server-only";

import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: bigint | string | null;
  branchId?: bigint | string | null;
  /** Ví dụ: LOGIN_SUCCESS, LOGIN_FAILED, PAYMENT_VOID. */
  action: string;
  entityType: string;
  entityId?: bigint | string | number | null;
  oldData?: unknown;
  newData?: unknown;
};

function toBigInt(value: bigint | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Ghi nhật ký hệ thống. Không bao giờ làm hỏng thao tác chính:
 * lỗi ghi nhật ký chỉ được in ra console.
 * Tuyệt đối không đưa mật khẩu hoặc mã thông báo vào oldData/newData.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const userId = toBigInt(input.userId);
    const branchId = toBigInt(input.branchId);
    const entityId = toBigInt(input.entityId) ?? BigInt(0);
    const oldData = JSON.stringify(input.oldData ?? {});
    const newData =
      input.newData === undefined ? null : JSON.stringify(input.newData);

    await prisma.$executeRaw`
      INSERT INTO audit_logs
        (user_id, branch_id, action, entity_type, entity_id, old_data, new_data, created_at)
      VALUES
        (${userId}, ${branchId}, ${input.action}, ${input.entityType}, ${entityId}, ${oldData}, ${newData}, NOW())
    `;
  } catch (error) {
    console.error("AUDIT ERROR:", error);
  }
}