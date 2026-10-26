"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { callApi } from "@/lib/client-api";
import { ASSESSMENT_TYPE_LABELS } from "@/lib/assessments";

type AssessmentItem = {
  id: string;
  name: string;
  type: string | null;
  maxScore: string;
  scheduledDate: string;
  status: string;
  classCode: string;
  className: string;
  studentCount: number;
  gradedCount: number;
};

type ClassOption = { id: string; label: string };

type Sheet = {
  assessment: {
    id: string;
    name: string;
    type: string | null;
    maxScore: string;
    scheduledDate: string;
    status: string;
    classCode: string;
    className: string;
  };
  students: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    score: string | null;
    feedback: string | null;
  }>;
};

type Row = { score: string; feedback: string };

const statusLabels: Record<string, string> = {
  OPEN: "Đang nhập điểm",
  PUBLISHED: "Đã công bố",
};

const inputClass =
  "rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

export default function AssessmentsManager({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const [form, setForm] = useState({
    classId: "",
    name: "",
    type: "QUIZ",
    maxScore: "10",
    scheduledDate: "",
  });

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/assessments", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách.");
      }

      setItems(data.assessments);
      setClasses(data.classes);
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
    void loadList();
  }, [loadList]);

  async function openSheet(id: string) {
    setNotice(null);

    try {
      const response = await fetch(`/api/assessments/${id}`, {
        cache: "no-store",
      });
      const data: Sheet & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải bảng điểm.");
      }

      setSheet(data);

      const next: Record<string, Row> = {};

      for (const s of data.students) {
        next[s.studentId] = {
          score: s.score ?? "",
          feedback: s.feedback ?? "",
        };
      }

      setRows(next);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể tải dữ liệu.",
      });
    }
  }

  function setRow(studentId: string, patch: Partial<Row>) {
    setRows((current) => ({
      ...current,
      [studentId]: { ...current[studentId], ...patch },
    }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const result = await callApi("/api/assessments", "POST", form);

    setNotice({ type: result.ok ? "success" : "error", text: result.message });
    setSaving(false);

    if (result.ok) {
      setForm({ ...form, name: "" });
      await loadList();
    }
  }

  async function saveScores() {
    if (!sheet) return;

    const scores = sheet.students
      .filter((s) => (rows[s.studentId]?.score ?? "").trim() !== "")
      .map((s) => ({
        studentId: s.studentId,
        score: rows[s.studentId].score,
        feedback: rows[s.studentId].feedback,
      }));

    if (scores.length === 0) {
      setNotice({ type: "error", text: "Bạn chưa nhập điểm nào." });
      return;
    }

    setSaving(true);
    setNotice(null);

    const result = await callApi(
      `/api/assessments/${sheet.assessment.id}`,
      "PUT",
      { scores },
    );

    setNotice({ type: result.ok ? "success" : "error", text: result.message });
    setSaving(false);

    if (result.ok) {
      await loadList();
      await openSheet(sheet.assessment.id);
    }
  }

  async function publish() {
    if (!sheet) return;

    if (
      !window.confirm(
        "Công bố kết quả cho học viên và phụ huynh? Sau khi công bố sẽ không sửa điểm được nữa.",
      )
    ) {
      return;
    }

    setSaving(true);
    setNotice(null);

    const result = await callApi(
      `/api/assessments/${sheet.assessment.id}`,
      "PATCH",
      { status: "PUBLISHED" },
    );

    setNotice({ type: result.ok ? "success" : "error", text: result.message });
    setSaving(false);

    if (result.ok) {
      await loadList();
      await openSheet(sheet.assessment.id);
    }
  }

  const editable =
    canUpdate && sheet !== null && sheet.assessment.status === "OPEN";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Đánh giá &amp; điểm số</h1>
            <p className="mt-1 text-sm text-slate-600">
              Tạo bài đánh giá cho lớp, nhập điểm, công bố kết quả
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadList()}
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

        {canCreate && (
          <section className="rounded-lg border border-slate-300 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Tạo bài đánh giá</h2>

            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-5">
              <select
                className={inputClass}
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                required
              >
                <option value="">-- Lớp --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                className={inputClass}
                placeholder="Tên bài (Kiểm tra giữa kỳ)"
                value={form.name}
                maxLength={150}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(ASSESSMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="Điểm tối đa"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                required
              />

              <input
                type="date"
                className={inputClass}
                value={form.scheduledDate}
                onChange={(e) =>
                  setForm({ ...form, scheduledDate: e.target.value })
                }
                required
              />

              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60 md:col-span-5"
              >
                {saving ? "Đang lưu..." : "Tạo bài đánh giá"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">
            Danh sách bài đánh giá ({items.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="p-2">Bài</th>
                  <th className="p-2">Lớp</th>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Điểm tối đa</th>
                  <th className="p-2">Đã nhập</th>
                  <th className="p-2">Trạng thái</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      {loading ? "Đang tải..." : "Chưa có bài đánh giá nào."}
                    </td>
                  </tr>
                )}

                {items.map((a) => (
                  <tr key={a.id} className="border-b border-slate-200">
                    <td className="p-2">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-slate-500">
                        {ASSESSMENT_TYPE_LABELS[a.type ?? ""] ?? a.type ?? "-"}
                      </div>
                    </td>
                    <td className="p-2">
                      {a.classCode} - {a.className}
                    </td>
                    <td className="p-2">{a.scheduledDate}</td>
                    <td className="p-2">{a.maxScore}</td>
                    <td className="p-2">
                      {a.gradedCount}/{a.studentCount}
                    </td>
                    <td className="p-2">{statusLabels[a.status] ?? a.status}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => void openSheet(a.id)}
                        className="rounded-md border border-slate-400 px-3 py-1 hover:bg-slate-100"
                      >
                        {canUpdate && a.status === "OPEN" ? "Nhập điểm" : "Xem"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {sheet && (
          <section className="rounded-lg border border-slate-300 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {sheet.assessment.name} · {sheet.assessment.classCode} ·{" "}
                {sheet.assessment.scheduledDate} · tối đa{" "}
                {sheet.assessment.maxScore} điểm
              </h2>

              <span className="text-sm text-slate-600">
                {statusLabels[sheet.assessment.status] ?? sheet.assessment.status}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-300">
                    <th className="p-2">Học viên</th>
                    <th className="p-2">Điểm</th>
                    <th className="p-2">Nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-5 text-center text-slate-500">
                        Lớp chưa có học viên.
                      </td>
                    </tr>
                  )}

                  {sheet.students.map((s) => (
                    <tr key={s.studentId} className="border-b border-slate-200">
                      <td className="p-2">
                        {s.fullName}
                        <div className="text-xs text-slate-500">
                          {s.studentCode}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          className={`${inputClass} w-28`}
                          inputMode="decimal"
                          disabled={!editable}
                          value={rows[s.studentId]?.score ?? ""}
                          onChange={(e) =>
                            setRow(s.studentId, { score: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className={`${inputClass} w-full`}
                          disabled={!editable}
                          maxLength={1000}
                          value={rows[s.studentId]?.feedback ?? ""}
                          onChange={(e) =>
                            setRow(s.studentId, { feedback: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editable && sheet.students.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveScores()}
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu điểm"}
                </button>

                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={saving}
                  className="rounded-md border border-green-700 px-5 py-2 font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60"
                >
                  Công bố kết quả
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}