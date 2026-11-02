"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, RefreshCw, ShieldAlert, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/shared/FormField";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard, type Tone } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState, LoadingState } from "@/components/shared/states";

type Log = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string | null;
  entityId: string;
  userName: string | null;
  username: string | null;
  ip: string | null;
  detail: string;
};

const ACTIONS: Record<string, { label: string; tone: Tone }> = {
  LOGIN_SUCCESS: { label: "Đăng nhập thành công", tone: "green" },
  LOGIN_FAILED: { label: "Đăng nhập thất bại", tone: "red" },
  LOGIN_LOCKED: { label: "Bị khóa tạm", tone: "amber" },
  PASSWORD_CHANGE: { label: "Đổi mật khẩu", tone: "blue" },
  USER_CREATE: { label: "Tạo tài khoản", tone: "blue" },
  USER_STATUS_CHANGE: { label: "Đổi trạng thái tài khoản", tone: "amber" },
  USER_PASSWORD_RESET: { label: "Đặt lại mật khẩu", tone: "amber" },
  USER_PROFILE_UPDATE: { label: "Sửa thông tin tài khoản", tone: "blue" },
  PAYMENT_CREATE: { label: "Thu tiền", tone: "green" },
  PAYMENT_VOID: { label: "Hủy giao dịch", tone: "red" },
  ASSESSMENT_SCORES_SAVE: { label: "Lưu điểm", tone: "blue" },
  ASSESSMENT_PUBLISH: { label: "Công bố kết quả", tone: "green" },
  SESSION_CANCEL: { label: "Hủy buổi học", tone: "amber" },
  ROOM_UPDATE: { label: "Sửa phòng học", tone: "blue" },
  TEACHER_UPDATE: { label: "Sửa giáo viên", tone: "blue" },
};

export default function AuditViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  const load = useCallback(
    async (actionValue: string, fromValue: string, toValue: string) => {
      setLoading(true);

      try {
        const query = new URLSearchParams();

        if (actionValue) query.set("action", actionValue);
        if (fromValue) query.set("from", fromValue);
        if (toValue) query.set("to", toValue);

        const response = await fetch(`/api/audit?${query.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Không thể tải nhật ký.");
        }

        setLogs(data.logs);
        setActions(data.actions);
      } catch (error) {
        setNotice({
          type: "error",
          text:
            error instanceof Error ? error.message : "Không thể tải nhật ký.",
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("", "", "");
  }, [load]);

  const failed = logs.filter((l) => l.action === "LOGIN_FAILED").length;
  const locked = logs.filter((l) => l.action === "LOGIN_LOCKED").length;

  return (
    <div className="mx-auto max-w-7xl text-slate-900">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Đăng nhập và các thao tác quan trọng (tối đa 200 dòng mới nhất theo bộ lọc)"
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void load(action, from, to)}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            {loading ? "Đang tải..." : "Tải lại"}
          </Button>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Dòng hiển thị" value={logs.length} icon={ScrollText} tone="blue" />
        <StatCard label="Đăng nhập thất bại" value={failed} icon={ShieldAlert} tone="red" />
        <StatCard label="Lần bị khóa tạm" value={locked} icon={Lock} tone="amber" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Hành động
          <select
            className={`${inputClass} mt-1 block w-auto min-w-52`}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">Tất cả</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {ACTIONS[a]?.label ?? a}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Từ ngày
          <input
            type="date"
            className={`${inputClass} mt-1 block w-auto`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Đến ngày
          <input
            type="date"
            className={`${inputClass} mt-1 block w-auto`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <Button type="button" onClick={() => void load(action, from, to)} disabled={loading}>
          Lọc
        </Button>
      </div>

      {loading && logs.length === 0 ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState
          title="Chưa có nhật ký"
          description="Không có dòng nào khớp bộ lọc hiện tại."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="p-3">Thời gian</th>
                <th className="p-3">Người thực hiện</th>
                <th className="p-3">Hành động</th>
                <th className="p-3">Đối tượng</th>
                <th className="p-3">Chi tiết</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap p-3">{log.createdAt}</td>
                  <td className="p-3">
                    {log.userName ?? <span className="text-slate-400">(không xác định)</span>}
                    {log.username && (
                      <div className="text-xs text-slate-500">{log.username}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      status={log.action}
                      label={ACTIONS[log.action]?.label ?? log.action}
                      tone={ACTIONS[log.action]?.tone ?? "slate"}
                    />
                  </td>
                  <td className="p-3">
                    {log.entityType ?? "-"}
                    {log.entityId !== "0" ? ` #${log.entityId}` : ""}
                  </td>
                  <td className="max-w-xs break-words p-3 text-slate-600">{log.detail}</td>
                  <td className="p-3 text-slate-600">{log.ip ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}