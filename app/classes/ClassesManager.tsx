"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { callApi } from "@/lib/client-api";
import ClassDetail from "./ClassDetail";

type ClassItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  offeringCode: string;
  courseName: string;
  branchName: string;
  startDate: string;
  endDate: string;
  roomCode: string | null;
  roomCapacity: number | null;
  teacherName: string | null;
  studentCount: number;
  sessionCount: number;
};

type Option = { id: string; label: string };
type RoomOption = Option & { branchId: string };

type RoomItem = {
  id: string;
  branchName: string;
  code: string;
  name: string | null;
  capacity: number;
  status: string;
};

type TeacherItem = {
  id: string;
  teacherCode: string;
  fullName: string;
  email: string;
};

type Candidate = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
};

type Branch = { id: string; name: string };

const inputClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

const statusLabels: Record<string, string> = {
  ACTIVE: "Đang mở",
  CLOSED: "Đã đóng",
};

export default function ClassesManager({
  canCreate,
  canUpdate,
  canSchedule,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canSchedule: boolean;
}) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [offerings, setOfferings] = useState<Option[]>([]);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<Option[]>([]);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [openId, setOpenId] = useState<string | null>(null);

  const [classForm, setClassForm] = useState({
    offeringId: "",
    name: "",
    roomId: "",
    teacherId: "",
  });
  const [roomForm, setRoomForm] = useState({
    branchId: "",
    code: "",
    name: "",
    capacity: "20",
  });
  const [teacherUserId, setTeacherUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const notify = useCallback(
    (type: "success" | "error", text: string) => setNotice({ type, text }),
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/classes", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách lớp.");
      }

      setClasses(data.classes);
      setOfferings(data.offerings);
      setRoomOptions(data.rooms);
      setTeacherOptions(data.teachers);

      if (canCreate) {
        const [roomRes, teacherRes] = await Promise.all([
          fetch("/api/rooms", { cache: "no-store" }),
          fetch("/api/teachers", { cache: "no-store" }),
        ]);

        const roomData = await roomRes.json();
        const teacherData = await teacherRes.json();

        if (!roomRes.ok) {
          throw new Error(roomData.error ?? "Không thể tải phòng học.");
        }

        if (!teacherRes.ok) {
          throw new Error(teacherData.error ?? "Không thể tải giáo viên.");
        }

        setRooms(roomData.rooms);
        setBranches(roomData.branches);
        setTeachers(teacherData.teachers);
        setCandidates(teacherData.candidates);

        setRoomForm((current) => ({
          ...current,
          branchId: current.branchId || roomData.branches[0]?.id || "",
        }));
      }
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Không thể tải dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  }, [canCreate, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function submit(
    url: string,
    body: unknown,
    onSuccess: () => void,
  ) {
    setSaving(true);
    setNotice(null);

    const result = await callApi(url, "POST", body);

    notify(result.ok ? "success" : "error", result.message);
    setSaving(false);

    if (result.ok) {
      onSuccess();
      await loadData();
    }
  }

  function handleRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void submit("/api/rooms", roomForm, () =>
      setRoomForm((current) => ({ ...current, code: "", name: "" })),
    );
  }

  function handleTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void submit("/api/teachers", { userId: teacherUserId }, () =>
      setTeacherUserId(""),
    );
  }

  function handleClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void submit("/api/classes", classForm, () =>
      setClassForm({ offeringId: "", name: "", roomId: "", teacherId: "" }),
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">Lớp học &amp; lịch học</h1>

            <p className="mt-1 text-sm text-slate-600">
              Phòng học, giáo viên, lớp, xếp học viên và lập lịch
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
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-300 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold">Phòng học</h2>

              <form onSubmit={handleRoom} className="grid gap-3 sm:grid-cols-2">
                <select
                  className={inputClass}
                  value={roomForm.branchId}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, branchId: e.target.value })
                  }
                  required
                >
                  <option value="">-- Chi nhánh --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <input
                  className={inputClass}
                  placeholder="Mã phòng (P101)"
                  value={roomForm.code}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, code: e.target.value })
                  }
                  required
                />

                <input
                  className={inputClass}
                  placeholder="Tên phòng (không bắt buộc)"
                  value={roomForm.name}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, name: e.target.value })
                  }
                />

                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Sức chứa"
                  value={roomForm.capacity}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, capacity: e.target.value })
                  }
                  required
                />

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60 sm:col-span-2"
                >
                  Thêm phòng
                </button>
              </form>

              <ul className="mt-3 max-h-40 divide-y divide-slate-200 overflow-y-auto text-sm">
                {rooms.length === 0 && (
                  <li className="py-2 text-slate-500">Chưa có phòng nào.</li>
                )}
                {rooms.map((r) => (
                  <li key={r.id} className="py-2">
                    {r.code}
                    {r.name ? ` - ${r.name}` : ""} ({r.capacity} chỗ) -{" "}
                    {r.branchName}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold">Giáo viên</h2>

              <form onSubmit={handleTeacher} className="flex flex-wrap gap-3">
                <select
                  className={`${inputClass} flex-1`}
                  value={teacherUserId}
                  onChange={(e) => setTeacherUserId(e.target.value)}
                  required
                >
                  <option value="">
                    -- Tài khoản giáo viên chưa có hồ sơ --
                  </option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.username})
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Tạo hồ sơ giáo viên
                </button>
              </form>

              <ul className="mt-3 max-h-40 divide-y divide-slate-200 overflow-y-auto text-sm">
                {teachers.length === 0 && (
                  <li className="py-2 text-slate-500">
                    Chưa có hồ sơ giáo viên.
                  </li>
                )}
                {teachers.map((t) => (
                  <li key={t.id} className="py-2">
                    {t.teacherCode} - {t.fullName} ({t.email})
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {canCreate && (
          <section className="rounded-lg border border-slate-300 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Tạo lớp học</h2>

            <form onSubmit={handleClass} className="grid gap-4 md:grid-cols-4">
              <select
                className={inputClass}
                value={classForm.offeringId}
                onChange={(e) =>
                  setClassForm({ ...classForm, offeringId: e.target.value })
                }
                required
              >
                <option value="">-- Khóa học đang mở --</option>
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>

              <input
                className={inputClass}
                placeholder="Tên lớp"
                value={classForm.name}
                onChange={(e) =>
                  setClassForm({ ...classForm, name: e.target.value })
                }
                required
              />

              <select
                className={inputClass}
                value={classForm.roomId}
                onChange={(e) =>
                  setClassForm({ ...classForm, roomId: e.target.value })
                }
                required
              >
                <option value="">-- Phòng học --</option>
                {roomOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>

              <select
                className={inputClass}
                value={classForm.teacherId}
                onChange={(e) =>
                  setClassForm({ ...classForm, teacherId: e.target.value })
                }
                required
              >
                <option value="">-- Giáo viên chính --</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60 md:col-span-4"
              >
                {saving ? "Đang lưu..." : "Tạo lớp"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-300 bg-white">
          <h2 className="p-5 pb-3 text-lg font-semibold">
            Danh sách lớp ({classes.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-300 text-slate-600">
                  <th className="p-3">Lớp</th>
                  <th className="p-3">Khóa học</th>
                  <th className="p-3">Phòng</th>
                  <th className="p-3">Giáo viên</th>
                  <th className="p-3">Học viên</th>
                  <th className="p-3">Buổi học</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3" />
                </tr>
              </thead>

              <tbody>
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      {loading ? "Đang tải..." : "Chưa có lớp nào."}
                    </td>
                  </tr>
                )}

                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200 align-top">
                    <td className="p-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.code}</div>
                    </td>
                    <td className="p-3">
                      <div>{c.courseName}</div>
                      <div className="text-xs text-slate-500">
                        {c.offeringCode} · {c.startDate} → {c.endDate}
                      </div>
                    </td>
                    <td className="p-3">
                      {c.roomCode ?? "-"}
                      {c.roomCapacity ? ` (${c.roomCapacity} chỗ)` : ""}
                    </td>
                    <td className="p-3">{c.teacherName ?? "-"}</td>
                    <td className="p-3">{c.studentCount}</td>
                    <td className="p-3">{c.sessionCount}</td>
                    <td className="p-3">{statusLabels[c.status] ?? c.status}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenId(openId === c.id ? null : c.id)
                        }
                        className="rounded-md border border-slate-400 px-3 py-1 hover:bg-slate-100"
                      >
                        {openId === c.id ? "Thu gọn" : "Chi tiết"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {openId !== null && (
            <ClassDetail
              key={openId}
              classId={openId}
              classStatus={
                classes.find((c) => c.id === openId)?.status ?? "ACTIVE"
              }
              canUpdate={canUpdate}
              canSchedule={canSchedule}
              notify={notify}
              onChanged={() => void loadData()}
            />
          )}
        </section>
      </div>
    </main>
  );
}
