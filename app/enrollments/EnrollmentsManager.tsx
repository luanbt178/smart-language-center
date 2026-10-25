"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

type Enrollment = {
  id: string;
  status: string;
  price: string;
  createdAt: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  offeringId: string;
  offeringCode: string;
  courseName: string;
  branchName: string;
  invoiceNo: string | null;
  invoiceStatus: string | null;
  dueDate: string | null;
  paidAmount: string | null;
  remainingAmount: string | null;
};

type StudentOption = {
  id: string;
  studentCode: string;
  fullName: string;
  branchId: string;
  branchName: string;
};

type OfferingOption = {
  id: string;
  code: string;
  branchId: string;
  branchName: string;
  courseName: string;
  tuitionFee: string | null;
  maxStudents: number | null;
  enrolled: number;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Đang học",
  CANCELLED: "Đã hủy",
};

const invoiceLabels: Record<string, string> = {
  ISSUED: "Chờ thanh toán",
  PARTIAL: "Đã trả một phần",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
};

const inputClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

function money(value: string | null): string {
  if (value === null) return "-";

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")} đ`
    : value;
}

export default function EnrollmentsManager({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);

  const [studentId, setStudentId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/enrollments", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách ghi danh.");
      }

      setEnrollments(data.enrollments);
      setStudents(data.students);
      setOfferings(data.offerings);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const selectedOffering = offerings.find((o) => o.id === offeringId);

  // Chỉ cho chọn học viên cùng chi nhánh với khóa học đã chọn.
  const studentChoices = useMemo(
    () =>
      selectedOffering
        ? students.filter((s) => s.branchId === selectedOffering.branchId)
        : students,
    [students, selectedOffering],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return enrollments.filter((row) => {
      const matchesKeyword =
        keyword.length === 0 ||
        [
          row.studentCode,
          row.studentName,
          row.offeringCode,
          row.courseName,
          row.invoiceNo ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        filterStatus === "ALL" || row.status === filterStatus;

      return matchesKeyword && matchesStatus;
    });
  }, [enrollments, search, filterStatus]);

  async function callApi(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Thao tác thất bại.");
      }

      setNotice({
        type: "success",
        text: data.message ?? "Thành công.",
      });

      await loadData();
      return true;
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Đã xảy ra lỗi.",
      });

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await callApi("/api/enrollments", "POST", {
      studentId,
      offeringId,
      dueDate,
    });

    if (ok) {
      setStudentId("");
      setOfferingId("");
      setDueDate("");
    }
  }

  async function handleCancel(row: Enrollment) {
    const reason = window.prompt(
      `Lý do hủy ghi danh của ${row.studentName} (${row.courseName}):`,
    );

    if (reason === null) return;

    if (reason.trim() === "") {
      setNotice({ type: "error", text: "Cần nhập lý do hủy." });
      return;
    }

    await callApi(`/api/enrollments/${row.id}`, "PATCH", {
      status: "CANCELLED",
      reason,
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Ghi danh &amp; hóa đơn</h1>

            <p className="mt-1 text-sm text-slate-600">
              Ghi danh học viên vào khóa học, hệ thống tự tạo hóa đơn
              (học phí thu một lần)
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
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

        {canCreate && (
          <section className="rounded-lg border border-slate-300 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">
              Ghi danh học viên
            </h2>

            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-3"
            >
              <label className="block text-sm font-medium">
                Khóa học đang mở
                <select
                  className={`${inputClass} mt-1`}
                  value={offeringId}
                  onChange={(event) => {
                    setOfferingId(event.target.value);
                    setStudentId("");
                  }}
                  required
                >
                  <option value="">-- Chọn khóa học --</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} - {o.courseName} ({o.branchName}) -{" "}
                      {o.enrolled}/{o.maxStudents ?? "∞"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Học viên
                <select
                  className={`${inputClass} mt-1`}
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  required
                >
                  <option value="">-- Chọn học viên --</option>
                  {studentChoices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} - {s.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Hạn thanh toán (không bắt buộc)
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>

              <div className="md:col-span-3 flex flex-wrap items-center gap-4">
                <p className="text-sm text-slate-700">
                  Học phí:{" "}
                  <strong>
                    {selectedOffering
                      ? money(selectedOffering.tuitionFee)
                      : "-"}
                  </strong>
                </p>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Ghi danh & tạo hóa đơn"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">
              Danh sách ghi danh ({filtered.length})
            </h2>

            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Tìm học viên, khóa học, mã hóa đơn"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className={`${inputClass} max-w-[180px]`}
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang học</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="py-2 pr-3">Học viên</th>
                  <th className="py-2 pr-3">Khóa học</th>
                  <th className="py-2 pr-3">Hóa đơn</th>
                  <th className="py-2 pr-3">Học phí</th>
                  <th className="py-2 pr-3">Còn nợ</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      {loading ? "Đang tải..." : "Chưa có ghi danh nào."}
                    </td>
                  </tr>
                )}

                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.studentName}</div>
                      <div className="text-xs text-slate-500">
                        {row.studentCode}
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      <div>{row.courseName}</div>
                      <div className="text-xs text-slate-500">
                        {row.offeringCode} - {row.branchName}
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      <div>{row.invoiceNo ?? "-"}</div>
                      <div className="text-xs text-slate-500">
                        {row.invoiceStatus
                          ? (invoiceLabels[row.invoiceStatus] ??
                            row.invoiceStatus)
                          : ""}
                        {row.dueDate ? ` - hạn ${row.dueDate}` : ""}
                      </div>
                    </td>

                    <td className="py-2 pr-3">{money(row.price)}</td>
                    <td className="py-2 pr-3">{money(row.remainingAmount)}</td>

                    <td className="py-2 pr-3">
                      {statusLabels[row.status] ?? row.status}
                    </td>

                    <td className="py-2">
                      {canUpdate && row.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleCancel(row)}
                          className="rounded-md border border-red-400 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
