"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CheckCircle2, CircleAlert, Receipt, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { inputClass } from "@/components/shared/FormField";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { callApi } from "@/lib/client-api";

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  amount: string;
  dueDate: string | null;
  issuedAt: string;
  studentCode: string;
  studentName: string;
  courseName: string;
  offeringCode: string;
  branchName: string;
  paidAmount: string;
  remainingAmount: string;
};

type PaymentItem = {
  id: string;
  amount: string;
  method: string | null;
  transactionCode: string | null;
  paidAt: string;
  status: string;
  recordedBy: string;
};

const statusLabels: Record<string, string> = {
  ISSUED: "Chưa thanh toán",
  PARTIAL: "Trả một phần",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
};

const methodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
};

function money(value: string): string {
  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")} đ`
    : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const content = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  // \uFEFF giúp Excel đọc đúng tiếng Việt có dấu.
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PaymentsManager({
  canPay,
  today,
}: {
  canPay: boolean;
  today: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [payingId, setPayingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<PaymentItem[]>([]);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [transactionCode, setTransactionCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [notice, setNotice] = useState<NoticeState>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/invoices", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách hóa đơn.");
      }

      setInvoices(data.invoices);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể tải dữ liệu.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const loadHistory = useCallback(async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải lịch sử.");
      }

      setHistory(data.payments);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể tải dữ liệu.",
      });
    }
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return invoices.filter((row) => {
      const matchesKeyword =
        keyword === "" ||
        [row.invoiceNo, row.studentCode, row.studentName, row.courseName]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        filterStatus === "ALL" || row.status === filterStatus;

      return matchesKeyword && matchesStatus;
    });
  }, [invoices, search, filterStatus]);

  function exportCsv() {
    const header = [
      "Số hóa đơn",
      "Mã học viên",
      "Học viên",
      "Khóa học",
      "Đợt mở",
      "Chi nhánh",
      "Ngày lập",
      "Hạn thanh toán",
      "Số tiền",
      "Đã thu",
      "Còn lại",
      "Trạng thái",
    ];

    const body = filtered.map((row) => [
      row.invoiceNo,
      row.studentCode,
      row.studentName,
      row.courseName,
      row.offeringCode,
      row.branchName,
      row.issuedAt,
      row.dueDate ?? "",
      row.amount,
      row.paidAmount,
      row.remainingAmount,
      statusLabels[row.status] ?? row.status,
    ]);

    downloadCsv(`hoa-don-${today}.csv`, [header, ...body]);
  }

  const totals = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let remaining = 0;

    for (const row of invoices) {
      if (row.status === "CANCELLED") continue;

      billed += Number(row.amount);
      paid += Number(row.paidAmount);
      remaining += Number(row.remainingAmount);
    }

    return { billed, paid, remaining };
  }, [invoices]);


  function startPaying(row: Invoice) {
    setPayingId(row.id);
    setAmount(row.remainingAmount);
    setMethod("CASH");
    setTransactionCode("");
    setNotice(null);
  }

  async function submitPayment() {
    if (!payingId) return;

    setSaving(true);
    setNotice(null);

    const result = await callApi("/api/payments", "POST", {
      invoiceId: payingId,
      amount,
      method,
      transactionCode,
    });

    setNotice({
      type: result.ok ? "success" : "error",
      text: result.message,
    });
    setSaving(false);

    if (result.ok) {
      const id = payingId;

      setPayingId(null);
      await loadData();

      if (historyId === id) {
        await loadHistory(id);
      }
    }
  }

  async function voidPayment(paymentId: string): Promise<boolean> {
    setSaving(true);

    const result = await callApi(`/api/payments/${paymentId}`, "DELETE");

    setSaving(false);

    if (!result.ok) {
      setVoidError(result.message);
      return false;
    }

    setNotice({ type: "success", text: result.message });
    await loadData();

    if (historyId) {
      await loadHistory(historyId);
    }

    return true;
  }

  async function toggleHistory(id: string) {
    if (historyId === id) {
      setHistoryId(null);
      return;
    }

    setHistoryId(id);
    setHistory([]);
    await loadHistory(id);
  }

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Hóa đơn & thanh toán"
          description="Thu học phí, theo dõi công nợ"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={exportCsv}
                disabled={filtered.length === 0}
              >
                Xuất CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCw className={loading ? "animate-spin" : ""} />
                {loading ? "Đang tải..." : "Tải lại"}
              </Button>
            </>
          }
        />

        <Notice notice={notice} onClose={() => setNotice(null)} />

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Tổng phải thu"
            value={`${totals.billed.toLocaleString("vi-VN")} đ`}
            icon={Receipt}
            tone="blue"
          />
          <StatCard
            label="Đã thu"
            value={`${totals.paid.toLocaleString("vi-VN")} đ`}
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard
            label="Còn nợ"
            value={`${totals.remaining.toLocaleString("vi-VN")} đ`}
            icon={CircleAlert}
            tone="red"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              Hóa đơn ({filtered.length})
            </h2>

            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Tìm mã hóa đơn, học viên, khóa học"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className={inputClass}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="p-2">Hóa đơn</th>
                  <th className="p-2">Học viên</th>
                  <th className="p-2">Khóa học</th>
                  <th className="p-2">Phải thu</th>
                  <th className="p-2">Đã thu</th>
                  <th className="p-2">Còn nợ</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2" />
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      {loading ? "Đang tải..." : "Chưa có hóa đơn nào."}
                    </td>
                  </tr>
                )}

                {filtered.map((row) => {
                  const overdue =
                    row.dueDate !== null &&
                    row.dueDate < today &&
                    (row.status === "ISSUED" || row.status === "PARTIAL");

                  return (
                    <FragmentRows
                      key={row.id}
                      row={row}
                      overdue={overdue}
                      canPay={canPay}
                      payingId={payingId}
                      historyId={historyId}
                      history={history}
                      amount={amount}
                      method={method}
                      transactionCode={transactionCode}
                      saving={saving}
                      setAmount={setAmount}
                      setMethod={setMethod}
                      setTransactionCode={setTransactionCode}
                      onStartPaying={() => startPaying(row)}
                      onCancelPaying={() => setPayingId(null)}
                      onSubmit={() => void submitPayment()}
                      onToggleHistory={() => void toggleHistory(row.id)}
                      onVoid={(paymentId) => {
                        setVoidError(null);
                        setVoidTarget(paymentId);
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        title="Hủy giao dịch thu tiền?"
        description="Giao dịch sẽ chuyển sang trạng thái đã hủy và số tiền được tính lại trên hóa đơn."
        confirmLabel="Hủy giao dịch"
        cancelLabel="Giữ lại"
        destructive
        loading={saving}
        error={voidError}
        onConfirm={async () => {
          if (!voidTarget) return;

          const ok = await voidPayment(voidTarget);

          if (ok) setVoidTarget(null);
        }}
      />
    </div>
  );
}

function FragmentRows({
  row,
  overdue,
  canPay,
  payingId,
  historyId,
  history,
  amount,
  method,
  transactionCode,
  saving,
  setAmount,
  setMethod,
  setTransactionCode,
  onStartPaying,
  onCancelPaying,
  onSubmit,
  onToggleHistory,
  onVoid,
}: {
  row: Invoice;
  overdue: boolean;
  canPay: boolean;
  payingId: string | null;
  historyId: string | null;
  history: PaymentItem[];
  amount: string;
  method: string;
  transactionCode: string;
  saving: boolean;
  setAmount: (value: string) => void;
  setMethod: (value: string) => void;
  setTransactionCode: (value: string) => void;
  onStartPaying: () => void;
  onCancelPaying: () => void;
  onSubmit: () => void;
  onToggleHistory: () => void;
  onVoid: (paymentId: string) => void;
}) {
  const payable = row.status === "ISSUED" || row.status === "PARTIAL";

  return (
    <>
      <tr className="border-b border-slate-200 align-top">
        <td className="p-2">
          <div className="font-medium">{row.invoiceNo}</div>
          <div className="text-xs text-slate-500">
            {row.dueDate ? `Hạn ${row.dueDate}` : "Không đặt hạn"}
            {overdue && (
              <span className="ml-1 font-semibold text-red-700">· Quá hạn</span>
            )}
          </div>
        </td>
        <td className="p-2">
          {row.studentName}
          <div className="text-xs text-slate-500">{row.studentCode}</div>
        </td>
        <td className="p-2">
          {row.courseName}
          <div className="text-xs text-slate-500">{row.offeringCode}</div>
        </td>
        <td className="p-2">{money(row.amount)}</td>
        <td className="p-2">{money(row.paidAmount)}</td>
        <td className="p-2">{money(row.remainingAmount)}</td>
        <td className="p-2">
          <StatusBadge
            status={row.status}
            label={statusLabels[row.status]}
            tone={row.status === "ISSUED" ? "amber" : undefined}
          />
        </td>
        <td className="p-2">
          <div className="flex flex-wrap gap-2">
            {canPay && payable && (
              <button
                type="button"
                onClick={onStartPaying}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Thu tiền
              </button>
            )}

            <button
              type="button"
              onClick={onToggleHistory}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Lịch sử
            </button>
          </div>
        </td>
      </tr>

      {payingId === row.id && (
        <tr className="border-b border-slate-200 bg-blue-50">
          <td colSpan={8} className="p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium">
                Số tiền thu
                <input
                  className={`${inputClass} mt-1 block w-auto`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>

              <label className="text-sm font-medium">
                Hình thức
                <select
                  className={`${inputClass} mt-1 block w-auto`}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Mã giao dịch (nếu có)
                <input
                  className={`${inputClass} mt-1 block w-auto`}
                  maxLength={100}
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={onSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Xác nhận thu"}
              </button>

              <button
                type="button"
                onClick={onCancelPaying}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-white"
              >
                Đóng
              </button>
            </div>
          </td>
        </tr>
      )}

      {historyId === row.id && (
        <tr className="border-b border-slate-200 bg-slate-50">
          <td colSpan={8} className="p-3">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có giao dịch nào.</p>
            ) : (
              <ul className="divide-y divide-slate-200 text-sm">
                {history.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      {p.paidAt} · {money(p.amount)} ·{" "}
                      {methodLabels[p.method ?? ""] ?? p.method ?? "-"}
                      {p.transactionCode ? ` · ${p.transactionCode}` : ""} ·{" "}
                      {p.recordedBy} ·{" "}
                      <StatusBadge
                        status={p.status}
                        label={p.status === "COMPLETED" ? "Hợp lệ" : "Đã hủy"}
                        tone={p.status === "COMPLETED" ? "green" : "red"}
                      />
                    </span>

                    {canPay && p.status === "COMPLETED" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onVoid(p.id)}
                        className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Hủy giao dịch
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
