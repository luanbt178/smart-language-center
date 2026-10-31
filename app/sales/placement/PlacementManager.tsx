"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

type TestStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

type PlacementTest = {
  id: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  branchCode: string;
  branchName: string;
  testDate: string;
  status: TestStatus;
  listening: string | null;
  speaking: string | null;
  reading: string | null;
  writing: string | null;
  total: string | null;
  recommendedLevelId: string | null;
  levelCode: string | null;
  levelName: string | null;
  createdByName: string | null;
};

type LeadOption = {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  branchCode: string;
};

type Level = {
  id: string;
  code: string;
  name: string;
};

type ResultForm = {
  listening: string;
  speaking: string;
  reading: string;
  writing: string;
  recommendedLevelId: string;
};

const emptyResult: ResultForm = {
  listening: "",
  speaking: "",
  reading: "",
  writing: "",
  recommendedLevelId: "",
};

const statusLabels: Record<string, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Đã có kết quả",
  CANCELLED: "Đã hủy",
};

function statusClass(status: string) {
  switch (status) {
    case "SCHEDULED":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "COMPLETED":
      return "border-green-300 bg-green-50 text-green-800";
    case "CANCELLED":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-800";
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN");
}

export default function PlacementManager({
  canCreate,
}: {
  canCreate: boolean;
}) {
  const [tests, setTests] = useState<PlacementTest[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);

  const [leadId, setLeadId] = useState("");
  const [testDate, setTestDate] = useState("");

  const [resultTestId, setResultTestId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState<ResultForm>(emptyResult);

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
      const response = await fetch("/api/sales/placement", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Không thể tải dữ liệu kiểm tra đầu vào.",
        );
      }

      setTests(data.tests);
      setLeads(data.leads);
      setLevels(data.levels);
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

  const filteredTests = useMemo(
    () =>
      tests.filter(
        (test) =>
          filterStatus === "ALL" || test.status === filterStatus,
      ),
    [tests, filterStatus],
  );

  // Điểm trung bình xem trước khi nhập.
  const totalPreview = useMemo(() => {
    const values = [
      resultForm.listening,
      resultForm.speaking,
      resultForm.reading,
      resultForm.writing,
    ]
      .map((value) => value.trim().replace(",", "."))
      .filter((value) => value !== "" && !Number.isNaN(Number(value)))
      .map(Number);

    if (values.length === 0) return null;

    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;

    return Math.round(average * 100) / 100;
  }, [resultForm]);

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await callApi("/api/sales/placement", "POST", {
      leadId,
      testDate,
    });

    if (ok) {
      setLeadId("");
      setTestDate("");
    }
  }

  function openResult(test: PlacementTest) {
    setResultTestId(test.id);

    setResultForm({
      listening: test.listening ?? "",
      speaking: test.speaking ?? "",
      reading: test.reading ?? "",
      writing: test.writing ?? "",
      recommendedLevelId: test.recommendedLevelId ?? "",
    });

    setNotice(null);

    document.getElementById("result-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSaveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resultTestId) return;

    const ok = await callApi(
      `/api/sales/placement/${encodeURIComponent(resultTestId)}`,
      "PATCH",
      { action: "result", ...resultForm },
    );

    if (ok) {
      setResultTestId(null);
      setResultForm(emptyResult);
    }
  }

  async function handleCancel(test: PlacementTest) {
    if (!window.confirm(`Hủy lịch kiểm tra của ${test.leadName ?? "khách hàng"}?`)) {
      return;
    }

    await callApi(
      `/api/sales/placement/${encodeURIComponent(test.id)}`,
      "PATCH",
      { action: "cancel" },
    );
  }

  const inputClass =
    "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">
              Kiểm tra đầu vào (Placement Test)
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Sales — đặt lịch, nhập điểm, đề xuất trình độ
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
              Đặt lịch kiểm tra mới
            </h2>

            <form
              onSubmit={handleCreate}
              className="grid gap-4 sm:grid-cols-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Khách hàng
                </label>

                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">-- Chọn khách hàng --</option>

                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName}
                      {lead.phone ? ` - ${lead.phone}` : ""} (
                      {lead.branchCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ngày giờ kiểm tra
                </label>

                <input
                  type="datetime-local"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Đặt lịch"}
                </button>
              </div>
            </form>
          </section>
        )}

        {canCreate && resultTestId && (
          <section
            id="result-form"
            className="rounded-lg border border-blue-300 bg-blue-50 p-5"
          >
            <h2 className="mb-4 text-lg font-semibold">
              Nhập kết quả (thang điểm 0 - 100)
            </h2>

            <form
              onSubmit={handleSaveResult}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {(
                [
                  ["listening", "Nghe (có thể bỏ trống)"],
                  ["speaking", "Nói (có thể bỏ trống)"],
                  ["reading", "Đọc (bắt buộc)"],
                  ["writing", "Viết (bắt buộc)"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium">
                    {label}
                  </label>

                  <input
                    inputMode="decimal"
                    value={resultForm[field]}
                    onChange={(e) =>
                      setResultForm((current) => ({
                        ...current,
                        [field]: e.target.value,
                      }))
                    }
                    required={field === "reading" || field === "writing"}
                    className={inputClass}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Trình độ đề xuất
                </label>

                <select
                  value={resultForm.recommendedLevelId}
                  onChange={(e) =>
                    setResultForm((current) => ({
                      ...current,
                      recommendedLevelId: e.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">-- Chưa đề xuất --</option>

                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.code} - {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <p className="text-sm font-medium">
                  Điểm trung bình:{" "}
                  <strong>{totalPreview ?? "—"}</strong>
                </p>
              </div>

              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu kết quả"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResultTestId(null);
                    setResultForm(emptyResult);
                  }}
                  className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Danh sách bài kiểm tra ({filteredTests.length})
            </h2>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-slate-400 bg-white px-3 py-2"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SCHEDULED">Đã lên lịch</option>
              <option value="COMPLETED">Đã có kết quả</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          {loading ? (
            <p className="text-slate-600">Đang tải...</p>
          ) : filteredTests.length === 0 ? (
            <p className="text-slate-600">Chưa có bài kiểm tra nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="p-3">Khách hàng</th>
                    <th className="p-3">Chi nhánh</th>
                    <th className="p-3">Ngày giờ</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Nghe / Nói / Đọc / Viết</th>
                    <th className="p-3">TB</th>
                    <th className="p-3">Trình độ</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTests.map((test) => (
                    <tr
                      key={test.id}
                      className="border-b border-slate-200"
                    >
                      <td className="p-3">
                        <div className="font-medium">
                          {test.leadName ?? "—"}
                        </div>
                        <div className="text-xs text-slate-600">
                          {test.leadPhone ?? ""}
                        </div>
                      </td>

                      <td className="p-3">{test.branchCode}</td>
                      <td className="p-3">{formatDate(test.testDate)}</td>

                      <td className="p-3">
                        <span
                          className={`rounded border px-2 py-1 text-xs font-medium ${statusClass(
                            test.status,
                          )}`}
                        >
                          {statusLabels[test.status] ?? test.status}
                        </span>
                      </td>

                      <td className="p-3">
                        {test.status === "COMPLETED"
                          ? [
                              test.listening,
                              test.speaking,
                              test.reading,
                              test.writing,
                            ]
                              .map((value) => value ?? "—")
                              .join(" / ")
                          : "—"}
                      </td>

                      <td className="p-3 font-semibold">
                        {test.total ?? "—"}
                      </td>

                      <td className="p-3">
                        {test.levelCode
                          ? `${test.levelCode} - ${test.levelName}`
                          : "—"}
                      </td>

                      <td className="p-3">
                        {canCreate && test.status !== "CANCELLED" && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openResult(test)}
                              className="rounded-md border border-blue-600 px-3 py-1 text-blue-800 hover:bg-blue-50"
                            >
                              {test.status === "COMPLETED"
                                ? "Sửa điểm"
                                : "Nhập điểm"}
                            </button>

                            {test.status === "SCHEDULED" && (
                              <button
                                type="button"
                                onClick={() => void handleCancel(test)}
                                className="rounded-md border border-red-500 px-3 py-1 text-red-700 hover:bg-red-50"
                              >
                                Hủy
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}