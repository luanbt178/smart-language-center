"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/states";
import { callApi } from "@/lib/client-api";

type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: string[];
};

type Permission = {
  code: string;
  name: string;
  module: string | null;
  description: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  USER: "Tài khoản",
  ROLE: "Vai trò",
  AUDIT: "Nhật ký",
  REPORT: "Báo cáo",
  FINANCE: "Tài chính",
  ENROLLMENT: "Ghi danh",
  CLASS: "Lớp học",
  SCHEDULE: "Lịch học",
  ATTENDANCE: "Điểm danh",
  ASSESSMENT: "Đánh giá",
  LEAD: "Tuyển sinh",
  PLACEMENT: "Xếp lớp đầu vào",
  COURSE: "Khóa học",
  PAYMENT: "Thanh toán",
  INVOICE: "Hóa đơn",
  PORTAL: "Cổng thông tin",
  AI: "Trợ lý AI",
};

function sameSet(a: Set<string>, b: string[]): boolean {
  return a.size === new Set(b).size && b.every((code) => a.has(code));
}

export default function RolesManager({ canUpdate }: { canUpdate: boolean }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async (keepId?: string) => {
    setLoading(true);

    try {
      const response = await fetch("/api/roles", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải vai trò.");
      }

      const list = data.roles as Role[];
      const chosen = list.find((r) => r.id === keepId) ?? list[0];

      setRoles(list);
      setPermissions(data.permissions);
      setSelectedId(chosen?.id ?? "");
      setDraft(new Set(chosen?.permissions ?? []));
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể tải vai trò.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const dirty = selected ? !sameSet(draft, selected.permissions) : false;

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();

    for (const p of permissions) {
      const key = p.module ?? "OTHER";

      map.set(key, [...(map.get(key) ?? []), p]);
    }

    return Array.from(map.entries());
  }, [permissions]);

  const added = selected
    ? [...draft].filter((code) => !selected.permissions.includes(code))
    : [];
  const removed = selected
    ? selected.permissions.filter((code) => !draft.has(code))
    : [];

  function choose(role: Role) {
    setSelectedId(role.id);
    setDraft(new Set(role.permissions));
    setNotice(null);
  }

  function toggle(code: string) {
    setDraft((current) => {
      const next = new Set(current);

      if (next.has(code)) next.delete(code);
      else next.add(code);

      return next;
    });
  }

  function toggleModule(items: Permission[]) {
    setDraft((current) => {
      const next = new Set(current);
      const allOn = items.every((p) => next.has(p.code));

      for (const p of items) {
        if (allOn) next.delete(p.code);
        else next.add(p.code);
      }

      return next;
    });
  }

  async function save() {
    if (!selected) return;

    setSaving(true);
    setConfirmError(null);

    const result = await callApi(`/api/roles/${selected.id}`, "PUT", {
      permissions: [...draft],
    });

    setSaving(false);

    if (!result.ok) {
      setConfirmError(result.message);
      return;
    }

    setConfirmOpen(false);
    setNotice({ type: "success", text: result.message });
    await load(selected.id);
  }

  return (
    <div className="mx-auto max-w-7xl text-slate-900">
      <PageHeader
        title="Vai trò & quyền"
        description="Xem và cấu hình quyền theo vai trò. Quyền mới có hiệu lực khi người dùng đăng nhập lại."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void load(selectedId)}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            {loading ? "Đang tải..." : "Tải lại"}
          </Button>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {loading && roles.length === 0 ? (
        <LoadingState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-2">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => choose(role)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition-colors ${
                    role.id === selectedId
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{role.name}</p>
                  <p className="text-xs text-slate-500">{role.code}</p>
                  <p className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                    <span>{role.permissions.length} quyền</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {role.userCount} người dùng
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  {selected.description && (
                    <p className="text-sm text-slate-500">
                      {selected.description}
                    </p>
                  )}
                </div>

                {canUpdate ? (
                  <Button
                    type="button"
                    disabled={!dirty}
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmOpen(true);
                    }}
                  >
                    Lưu thay đổi
                  </Button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    Chỉ xem
                  </span>
                )}
              </div>

              <div className="space-y-5">
                {groups.map(([module, items]) => (
                  <div key={module}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {MODULE_LABELS[module] ?? module}
                      </h3>

                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => toggleModule(items)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          {items.every((p) => draft.has(p.code))
                            ? "Bỏ chọn nhóm"
                            : "Chọn cả nhóm"}
                        </button>
                      )}
                    </div>

                    <ul className="grid gap-2 sm:grid-cols-2">
                      {items.map((p) => (
                        <li key={p.code}>
                          <label
                            className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${
                              draft.has(p.code)
                                ? "border-blue-200 bg-blue-50/50"
                                : "border-slate-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={draft.has(p.code)}
                              disabled={!canUpdate}
                              onChange={() => toggle(p.code)}
                            />
                            <span>
                              <span className="font-medium">{p.name}</span>
                              <span className="block text-xs text-slate-500">
                                {p.code}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Lưu quyền của vai trò ${selected?.name ?? ""}?`}
        description={`Thêm ${added.length} quyền, bỏ ${removed.length} quyền. Người dùng thuộc vai trò này cần đăng nhập lại để áp dụng.`}
        confirmLabel="Lưu"
        cancelLabel="Xem lại"
        loading={saving}
        error={confirmError}
        onConfirm={() => void save()}
      />
    </div>
  );
}