"use client";

import { useCallback, useEffect, useState } from "react";

import { callApi } from "@/lib/client-api";

type Detail = {
  students: Array<{
    enrollmentId: string;
    studentCode: string;
    fullName: string;
    phone: string | null;
  }>;
  candidates: Array<{ enrollmentId: string; label: string }>;
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  sessions: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    roomCode: string;
    teacherName: string;
  }>;
};

type SlotForm = { dayOfWeek: string; startTime: string; endTime: string };

const dayLabels: Record<number, string> = {
  1: "Thứ hai",
  2: "Thứ ba",
  3: "Thứ tư",
  4: "Thứ năm",
  5: "Thứ sáu",
  6: "Thứ bảy",
  7: "Chủ nhật",
};

const sessionLabels: Record<string, string> = {
  SCHEDULED: "Chưa học",
  DONE: "Đã học",
  CANCELLED: "Đã hủy",
};

const inputClass =
  "rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

export default function ClassDetail({
  classId,
  classStatus,
  canUpdate,
  canSchedule,
  notify,
  onChanged,
}: {
  classId: string;
  classStatus: string;
  canUpdate: boolean;
  canSchedule: boolean;
  notify: (type: "success" | "error", text: string) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [candidateId, setCandidateId] = useState("");
  const [slots, setSlots] = useState<SlotForm[]>([
    { dayOfWeek: "2", startTime: "18:00", endTime: "19:30" },
  ]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/classes/${classId}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải chi tiết lớp.");
      }

      setDetail(data);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Không thể tải dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  }, [classId, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) {
    setBusy(true);

    const result = await callApi(url, method, body);

    notify(result.ok ? "success" : "error", result.message);
    setBusy(false);

    if (result.ok) {
      await load();
      onChanged();
    }

    return result.ok;
  }

  function updateSlot(index: number, field: keyof SlotForm, value: string) {
    setSlots((current) =>
      current.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot,
      ),
    );
  }

  if (loading && !detail) {
    return <p className="p-4 text-sm text-slate-600">Đang tải chi tiết...</p>;
  }

  if (!detail) {
    return null;
  }

  const hasSessions = detail.sessions.length > 0;

  return (
    <div className="space-y-5 border-t border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          Học viên trong lớp ({detail.students.length})
        </h3>

        {canUpdate && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(`/api/classes/${classId}`, "PATCH", {
                status: classStatus === "ACTIVE" ? "CLOSED" : "ACTIVE",
              })
            }
            className="rounded-md border border-slate-400 bg-white px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-60"
          >
            {classStatus === "ACTIVE" ? "Đóng lớp" : "Mở lại lớp"}
          </button>
        )}
      </div>

      {canUpdate && (
        <div className="flex flex-wrap gap-2">
          <select
            className={`${inputClass} min-w-[260px]`}
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          >
            <option value="">-- Chọn học viên đã ghi danh, chưa có lớp --</option>
            {detail.candidates.map((c) => (
              <option key={c.enrollmentId} value={c.enrollmentId}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={busy || candidateId === ""}
            onClick={async () => {
              const ok = await run(`/api/classes/${classId}/students`, "POST", {
                enrollmentId: candidateId,
                action: "add",
              });

              if (ok) setCandidateId("");
            }}
            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            Xếp vào lớp
          </button>
        </div>
      )}

      <ul className="divide-y divide-slate-200 rounded-md border border-slate-300 bg-white text-sm">
        {detail.students.length === 0 && (
          <li className="p-3 text-slate-500">Chưa có học viên.</li>
        )}

        {detail.students.map((s) => (
          <li
            key={s.enrollmentId}
            className="flex items-center justify-between gap-3 p-3"
          >
            <span>
              {s.studentCode} - {s.fullName}
              {s.phone ? ` (${s.phone})` : ""}
            </span>

            {canUpdate && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(`/api/classes/${classId}/students`, "POST", {
                    enrollmentId: s.enrollmentId,
                    action: "remove",
                  })
                }
                className="rounded-md border border-red-400 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Bỏ khỏi lớp
              </button>
            )}
          </li>
        ))}
      </ul>

      <div>
        <h3 className="mb-2 font-semibold">Lịch học</h3>

        {detail.schedules.length > 0 && (
          <p className="mb-2 text-sm text-slate-700">
            Mỗi tuần:{" "}
            {detail.schedules
              .map(
                (s) =>
                  `${dayLabels[s.dayOfWeek]} ${s.startTime}-${s.endTime}`,
              )
              .join("; ")}
          </p>
        )}

        {canSchedule && !hasSessions && classStatus === "ACTIVE" && (
          <div className="space-y-2 rounded-md border border-slate-300 bg-white p-3">
            {slots.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <select
                  className={inputClass}
                  value={slot.dayOfWeek}
                  onChange={(event) =>
                    updateSlot(index, "dayOfWeek", event.target.value)
                  }
                >
                  {Object.entries(dayLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  className={inputClass}
                  value={slot.startTime}
                  onChange={(event) =>
                    updateSlot(index, "startTime", event.target.value)
                  }
                />

                <span>đến</span>

                <input
                  type="time"
                  className={inputClass}
                  value={slot.endTime}
                  onChange={(event) =>
                    updateSlot(index, "endTime", event.target.value)
                  }
                />

                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSlots((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="rounded-md border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
                  >
                    Bỏ
                  </button>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSlots((current) => [
                    ...current,
                    { dayOfWeek: "4", startTime: "18:00", endTime: "19:30" },
                  ])
                }
                className="rounded-md border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
              >
                + Thêm buổi trong tuần
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(`/api/classes/${classId}/schedule`, "POST", {
                    slots,
                  })
                }
                className="rounded-md bg-blue-700 px-4 py-1 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {busy ? "Đang tạo..." : "Tạo lịch & sinh buổi học"}
              </button>
            </div>
          </div>
        )}

        {canSchedule && hasSessions && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Xóa toàn bộ lịch của lớp này?")) {
                void run(`/api/classes/${classId}/schedule`, "DELETE");
              }
            }}
            className="mb-2 rounded-md border border-red-400 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Xóa toàn bộ lịch
          </button>
        )}

        {hasSessions && (
          <div className="max-h-72 overflow-y-auto rounded-md border border-slate-300 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2">Ngày</th>
                  <th className="p-2">Giờ</th>
                  <th className="p-2">Phòng</th>
                  <th className="p-2">Giáo viên</th>
                  <th className="p-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {detail.sessions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="p-2">{s.date}</td>
                    <td className="p-2">
                      {s.startTime}-{s.endTime}
                    </td>
                    <td className="p-2">{s.roomCode}</td>
                    <td className="p-2">{s.teacherName}</td>
                    <td className="p-2">
                      {sessionLabels[s.status] ?? s.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
