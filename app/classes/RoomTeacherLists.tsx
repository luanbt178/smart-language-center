"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, inputClass } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { callApi } from "@/lib/client-api";

export type RoomItem = {
  id: string;
  branchName: string;
  code: string;
  name: string | null;
  capacity: number;
  status: string;
};

export type TeacherItem = {
  id: string;
  teacherCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  employmentStatus: string | null;
};

type Notify = (type: "success" | "error", text: string) => void;

export function RoomList({
  rooms,
  notify,
  onChanged,
}: {
  rooms: RoomItem[];
  notify: Notify;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<RoomItem | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(room: RoomItem) {
    setEditing(room);
    setError(null);
    setName(room.name ?? "");
    setCapacity(String(room.capacity));
    setStatus(room.status);
  }

  async function save() {
    if (!editing) return;

    setSaving(true);

    const result = await callApi(`/api/rooms/${editing.id}`, "PATCH", {
      name,
      capacity: Number(capacity),
      status,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    notify("success", result.message);
    setEditing(null);
    onChanged();
  }

  return (
    <>
      <ul className="mt-4 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
        {rooms.length === 0 && (
          <li className="py-3 text-slate-500">Chưa có phòng nào.</li>
        )}

        {rooms.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">
                {r.code}
                {r.name ? ` - ${r.name}` : ""}
              </p>
              <p className="truncate text-xs text-slate-500">
                {r.capacity} chỗ · {r.branchName}
              </p>
            </div>

            <StatusBadge status={r.status} />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Sửa phòng ${r.code}`}
              onClick={() => open(r)}
            >
              <Pencil className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa phòng {editing?.code}</DialogTitle>
            <DialogDescription>
              Mã phòng và chi nhánh không đổi được. Phòng đang có lớp mở thì
              không ẩn được.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField label="Tên phòng" htmlFor="room-name">
              <input
                id="room-name"
                className={inputClass}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>

            <FormField label="Sức chứa" htmlFor="room-capacity" required>
              <input
                id="room-capacity"
                type="number"
                min={1}
                max={500}
                className={inputClass}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </FormField>

            <FormField label="Trạng thái" htmlFor="room-status">
              <select
                id="room-status"
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ẩn (ngừng sử dụng)</option>
              </select>
            </FormField>
          </div>

          {error && <Notice notice={{ type: "error", text: error }} />}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Hủy
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TeacherList({
  teachers,
  notify,
  onChanged,
}: {
  teachers: TeacherItem[];
  notify: Notify;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TeacherItem | null>(null);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(teacher: TeacherItem) {
    setEditing(teacher);
    setError(null);
    setPhone(teacher.phone ?? "");
    setStatus(teacher.employmentStatus ?? "ACTIVE");
  }

  async function save() {
    if (!editing) return;

    setSaving(true);

    const result = await callApi(`/api/teachers/${editing.id}`, "PATCH", {
      phone,
      employmentStatus: status,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    notify("success", result.message);
    setEditing(null);
    onChanged();
  }

  return (
    <>
      <ul className="mt-4 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
        {teachers.length === 0 && (
          <li className="py-3 text-slate-500">Chưa có hồ sơ giáo viên.</li>
        )}

        {teachers.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">
                {t.teacherCode} - {t.fullName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {t.email}
                {t.phone ? ` · ${t.phone}` : ""}
              </p>
            </div>

            <StatusBadge status={t.employmentStatus ?? "ACTIVE"} />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Sửa giáo viên ${t.teacherCode}`}
              onClick={() => open(t)}
            >
              <Pencil className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa giáo viên {editing?.teacherCode}</DialogTitle>
            <DialogDescription>
              {editing?.fullName}. Giáo viên đang dạy chính lớp đang mở thì
              không ngừng được.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField label="Số điện thoại" htmlFor="teacher-phone">
              <input
                id="teacher-phone"
                className={inputClass}
                value={phone}
                maxLength={30}
                onChange={(e) => setPhone(e.target.value)}
              />
            </FormField>

            <FormField label="Trạng thái" htmlFor="teacher-status">
              <select
                id="teacher-status"
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng giảng dạy</option>
              </select>
            </FormField>
          </div>

          {error && <Notice notice={{ type: "error", text: error }} />}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Hủy
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
