"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

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

const inputClass =
  "rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

function money(value: string): string {
  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")} đ`
    : value;
}

export default function PaymentsManager({ canPay }: { canPay: boolean }) {
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

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const today = new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

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

  async function voidPayment(paymentId: string) {
    if (!window.confirm("Hủy giao dịch thu tiền này?")) return;

    setSaving(true);

    const result = await callApi(`/api/payments/${paymentId}`, "DELETE");

    setNotice({
      type: result.ok ? "success" : "error",
      text: result.message,
    });
    setSaving(false);

    if (result.ok) {
      await loadData();

      if (historyId) {
        await loadHistory(historyId);
      }
    }
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
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Hóa đơn &amp; thanh toán</h1>
            <p className="mt-1 text-sm text-slate-600">
              Thu học phí, theo dõi công nợ
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-60"
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>

            <Link
              href="/dashboard"
              className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {notice && (
          <div
            className={`rounded-md border p-3 text-sm ${
              notice.type === "success"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            {notice.text}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Tổng phải thu", totals.billed],
            ["Đã thu", totals.paid],
            ["Còn nợ", totals.remaining],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-slate-300 bg-white p-5"
            >
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-1 text-2xl font-bold">
                {Number(value).toLocaleString("vi-VN")} đ
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              Hóa đơn ({filtered.length})
            </h2>

            <input
              className={`${inputClass} w-full max-w-xs`}
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
                <tr className="border-b border-slate-300 text-slate-600">
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
                      onVoid={(paymentId) => void voidPayment(paymentId)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
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
        <td className="p-2">{statusLabels[row.status] ?? row.status}</td>
        <td className="p-2">
          <div className="flex flex-wrap gap-2">
            {canPay && payable && (
              <button
                type="button"
                onClick={onStartPaying}
                className="rounded-md bg-blue-700 px-3 py-1 font-semibold text-white hover:bg-blue-800"
              >
                Thu tiền
              </button>
            )}

            <button
              type="button"
              onClick={onToggleHistory}
              className="rounded-md border border-slate-400 px-3 py-1 hover:bg-slate-100"
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
                  className={`${inputClass} mt-1 block`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>

              <label className="text-sm font-medium">
                Hình thức
                <select
                  className={`${inputClass} mt-1 block`}
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
                  className={`${inputClass} mt-1 block`}
                  maxLength={100}
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={onSubmit}
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Xác nhận thu"}
              </button>

              <button
                type="button"
                onClick={onCancelPaying}
                className="rounded-md border border-slate-400 px-4 py-2 hover:bg-white"
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
                      <strong>
                        {p.status === "COMPLETED" ? "Hợp lệ" : "Đã hủy"}
                      </strong>
                    </span>

                    {canPay && p.status === "COMPLETED" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onVoid(p.id)}
                        className="rounded-md border border-red-400 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
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
