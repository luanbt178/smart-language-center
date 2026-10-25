"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { callApi } from "@/lib/client-api";

type SessionItem = {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  roomCode: string;
  studentCount: number;
  recordedCount: number;
};

type Sheet = {
  session: {
    id: string;
    classCode: string;
    className: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    isFuture: boolean;
  };
  students: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    status: string | null;
    note: string | null;
  }>;
};

type Row = { status: string; note: string };

const options = [
  { value: "PRESENT", label: "Có mặt" },
  { value: "ABSENT", label: "Vắng" },
  { value: "LATE", label: "Đi muộn" },
  { value: "EXCUSED", label: "Có phép" },
];

const inputClass =
  "rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

export default function AttendanceManager({
  canRecord,
}: {
  canRecord: boolean;
}) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadSessions = useCallback(
    async (fromValue: string, toValue: string, classValue: string) => {
      setLoading(true);

      try {
        const query = new URLSearchParams();

        if (fromValue) query.set("from", fromValue);
        if (toValue) query.set("to", toValue);
        if (classValue) query.set("classId", classValue);

        const response = await fetch(`/api/attendance?${query.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Không thể tải danh sách buổi học.");
        }

        setSessions(data.sessions);
        setFrom((current) => current || data.from);
        setTo((current) => current || data.to);
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
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions("", "", "");
  }, [loadSessions]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const s of sessions) {
      map.set(s.classId, `${s.classCode} - ${s.className}`);
    }

    return Array.from(map.entries());
  }, [sessions]);

  async function openSheet(sessionId: string) {
    setNotice(null);

    try {
      const response = await fetch(`/api/attendance/${sessionId}`, {
        cache: "no-store",
      });
      const data: Sheet & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải bảng điểm danh.");
      }

      setSheet(data);

      const next: Record<string, Row> = {};

      for (const s of data.students) {
        next[s.studentId] = {
          status: s.status ?? "PRESENT",
          note: s.note ?? "",
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

  async function save() {
    if (!sheet) return;

    setSaving(true);
    setNotice(null);

    const result = await callApi(`/api/attendance/${sheet.session.id}`, "PUT", {
      records: sheet.students.map((s) => ({
        studentId: s.studentId,
        status: rows[s.studentId]?.status ?? "PRESENT",
        note: rows[s.studentId]?.note ?? "",
      })),
    });

    setNotice({
      type: result.ok ? "success" : "error",
      text: result.message,
    });
    setSaving(false);

    if (result.ok) {
      await loadSessions(from, to, classFilter);
      await openSheet(sheet.session.id);
    }
  }

  const editable = canRecord && sheet !== null && !sheet.session.isFuture;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Điểm danh</h1>
            <p className="mt-1 text-sm text-slate-600">
              Chọn buổi học, đánh dấu từng học viên rồi bấm Lưu
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
          >
            Dashboard
          </Link>
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

        <section className="rounded-lg border border-slate-300 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              Từ ngày
              <input
                type="date"
                className={`${inputClass} mt-1 block`}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>

            <label className="text-sm font-medium">
              Đến ngày
              <input
                type="date"
                className={`${inputClass} mt-1 block`}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>

            <label className="text-sm font-medium">
              Lớp
              <select
                className={`${inputClass} mt-1 block`}
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">Tất cả lớp</option>
                {classOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void loadSessions(from, to, classFilter)}
              disabled={loading}
              className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Đang tải..." : "Lọc"}
            </button>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border border-slate-300">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Giờ</th>
                  <th className="p-2">Lớp</th>
                  <th className="p-2">Phòng</th>
                  <th className="p-2">Đã điểm danh</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-slate-500">
                      {loading ? "Đang tải..." : "Không có buổi học trong khoảng này."}
                    </td>
                  </tr>
                )}

                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="p-2">{s.date}</td>
                    <td className="p-2">
                      {s.startTime}-{s.endTime}
                    </td>
                    <td className="p-2">
                      {s.classCode} - {s.className}
                    </td>
                    <td className="p-2">{s.roomCode}</td>
                    <td className="p-2">
                      {s.recordedCount}/{s.studentCount}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => void openSheet(s.id)}
                        className="rounded-md border border-slate-400 px-3 py-1 hover:bg-slate-100"
                      >
                        {canRecord ? "Điểm danh" : "Xem"}
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
                {sheet.session.classCode} - {sheet.session.className} ·{" "}
                {sheet.session.date} {sheet.session.startTime}-
                {sheet.session.endTime}
              </h2>

              {editable && (
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) => {
                      const next: Record<string, Row> = {};

                      for (const [id, row] of Object.entries(current)) {
                        next[id] = { ...row, status: "PRESENT" };
                      }

                      return next;
                    })
                  }
                  className="rounded-md border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
                >
                  Tất cả có mặt
                </button>
              )}
            </div>

            {sheet.session.isFuture && (
              <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Chưa đến ngày học nên chưa thể điểm danh.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-300">
                    <th className="p-2">Học viên</th>
                    <th className="p-2">Trạng thái</th>
                    <th className="p-2">Ghi chú</th>
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
                        <div className="flex flex-wrap gap-3">
                          {options.map((o) => (
                            <label key={o.value} className="flex items-center gap-1">
                              <input
                                type="radio"
                                name={`att-${s.studentId}`}
                                disabled={!editable}
                                checked={rows[s.studentId]?.status === o.value}
                                onChange={() =>
                                  setRow(s.studentId, { status: o.value })
                                }
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          className={`${inputClass} w-full`}
                          disabled={!editable}
                          maxLength={500}
                          value={rows[s.studentId]?.note ?? ""}
                          onChange={(e) =>
                            setRow(s.studentId, { note: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editable && sheet.students.length > 0 && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="mt-4 rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu điểm danh"}
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
