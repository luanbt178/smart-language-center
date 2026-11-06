"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { LoadingState } from "@/components/shared/states";
import { todayVN } from "@/lib/dates";

type Session = {
  id: string;
  classId: string;
  classCode: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  roomCode: string;
  roomName: string | null;
  teacherName: string;
  branchName: string;
};

const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // Thứ 2 = 0
  return addDays(value, -weekday);
}

function dayMonth(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export default function ScheduleView() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayVN()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [classId, setClassId] = useState("");

  const load = useCallback(async () => {
  try {
    const response = await fetch(`/api/schedule?from=${weekStart}`, {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể tải lịch học.");
    }

    setSessions(result.sessions);
    setNotice(null);
  } catch (error) {
    setSessions([]);
    setNotice({
      type: "error",
      text: error instanceof Error ? error.message : "Không thể tải lịch học.",
    });
  } finally {
    setLoading(false);
  }
}, [weekStart]);

 useEffect(() => {
  let cancelled = false;

  async function fetchSchedule() {
    try {
      const response = await fetch(`/api/schedule?from=${weekStart}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải lịch học.");
      }

      if (!cancelled) {
        setSessions(result.sessions);
        setNotice(null);
      }
    } catch (error) {
      if (!cancelled) {
        setSessions([]);
        setNotice({
          type: "error",
          text: error instanceof Error ? error.message : "Không thể tải lịch học.",
        });
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchSchedule();

  return () => {
    cancelled = true;
  };
}, [weekStart]);

  const teachers = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.teacherName))).sort(),
    [sessions],
  );
  const rooms = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.roomCode))).sort(),
    [sessions],
  );
  const classes = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => map.set(s.classId, `${s.classCode} - ${s.className}`));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const visible = sessions.filter(
    (s) =>
      (!teacher || s.teacherName === teacher) &&
      (!room || s.roomCode === room) &&
      (!classId || s.classId === classId),
  );

  const today = todayVN();
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const selectClass =
    "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Lịch học theo tuần"
        description={`Tuần ${dayMonth(weekStart)} – ${dayMonth(addDays(weekStart, 6))}/${addDays(weekStart, 6).slice(0, 4)}`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft />
              Tuần trước
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart(mondayOf(todayVN()))}
            >
              Tuần này
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Tuần sau
              <ChevronRight />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Làm mới
            </Button>
          </>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-3">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectClass}>
          <option value="">Tất cả lớp</option>
          {classes.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={selectClass}>
          <option value="">Tất cả giáo viên</option>
          {teachers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={room} onChange={(e) => setRoom(e.target.value)} className={selectClass}>
          <option value="">Tất cả phòng</option>
          {rooms.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {loading && sessions.length === 0 ? (
        <LoadingState text="Đang tải lịch học..." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
          {days.map((day, index) => {
            const items = visible.filter((s) => s.date === day);
            const isToday = day === today;

            return (
              <section
                key={day}
                className={`rounded-xl border bg-white p-3 shadow-sm ${
                  isToday ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
                }`}
              >
                <h2 className="mb-3 text-sm font-semibold text-slate-900">
                  {DAY_NAMES[index]}
                  <span className="ml-1 font-normal text-slate-500">{dayMonth(day)}</span>
                  {isToday && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Hôm nay
                    </span>
                  )}
                </h2>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400">Không có buổi học.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((s) => (
                      <li
                        key={s.id}
                        className={`rounded-lg border p-2 text-xs ${
                          s.status === "CANCELLED"
                            ? "border-red-200 bg-red-50 text-slate-500"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">
                          {s.startTime} – {s.endTime}
                        </p>
                        <p className="mt-0.5 font-medium">
                          {s.classCode} · {s.className}
                        </p>
                        <p className="mt-0.5">Phòng {s.roomCode}</p>
                        <p>{s.teacherName}</p>
                        {s.status === "CANCELLED" && (
                          <div className="mt-1">
                            <StatusBadge status="CANCELLED" />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}