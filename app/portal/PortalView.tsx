"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

type Child = {
  id: string;
  studentCode: string;
  fullName: string;
  status: string;
  branchName: string;
  classes: Array<{
    classCode: string;
    className: string;
    courseName: string;
    roomCode: string | null;
    teacherName: string | null;
  }>;
  upcoming: Array<{
    date: string;
    startTime: string;
    endTime: string;
    className: string;
    roomCode: string;
  }>;
  attendanceCounts: Record<string, number>;
  recentAttendance: Array<{
    date: string;
    className: string;
    status: string;
    note: string | null;
  }>;
  invoices: Array<{
    invoiceNo: string;
    status: string;
    amount: string;
    paidAmount: string;
    remainingAmount: string;
    dueDate: string | null;
    courseName: string;
  }>;
};

const attendanceLabels: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
};

const invoiceLabels: Record<string, string> = {
  ISSUED: "Chưa thanh toán",
  PARTIAL: "Trả một phần",
  PAID: "Đã thanh toán",
};

function money(value: string): string {
  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")} đ`
    : value;
}

export default function PortalView({ isParent }: { isParent: boolean }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/portal", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tải dữ liệu.");
      }

      setChildren(data.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">
              {isParent ? "Thông tin của con" : "Thông tin học tập"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Lịch học, chuyên cần và học phí (chỉ xem)
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
          >
            Dashboard
          </Link>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-slate-600">Đang tải...</p>}

        {!loading && !error && children.length === 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Chưa tìm thấy hồ sơ học viên liên kết với tài khoản của bạn. Vui
            lòng liên hệ trung tâm để được liên kết.
          </div>
        )}

        {children.map((child) => {
          const total = Object.values<number>(child.attendanceCounts).reduce(
            (sum: number, value: number) => sum + value,
            0,
          );
          const attended =
            (child.attendanceCounts.PRESENT ?? 0) +
            (child.attendanceCounts.LATE ?? 0);
          const rate = total === 0 ? null : Math.round((attended / total) * 100);

          return (
            <section
              key={child.id}
              className="space-y-5 rounded-lg border border-slate-300 bg-white p-5"
            >
              <div>
                <h2 className="text-xl font-bold">{child.fullName}</h2>
                <p className="text-sm text-slate-600">
                  {child.studentCode} · {child.branchName}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Lớp đang học</h3>
                {child.classes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Chưa được xếp lớp.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {child.classes.map((c) => (
                      <li key={c.classCode}>
                        <strong>{c.className}</strong> ({c.courseName}) · Phòng{" "}
                        {c.roomCode ?? "-"} · GV {c.teacherName ?? "-"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Lịch học sắp tới</h3>
                {child.upcoming.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Chưa có buổi học nào sắp tới.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 text-sm">
                    {child.upcoming.map((u, index) => (
                      <li key={index} className="py-1">
                        {u.date} · {u.startTime}-{u.endTime} · {u.className} ·
                        Phòng {u.roomCode}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">
                  Chuyên cần
                  {rate !== null ? ` — tham dự ${rate}% (${attended}/${total} buổi)` : ""}
                </h3>

                {total === 0 ? (
                  <p className="text-sm text-slate-500">
                    Chưa có dữ liệu điểm danh.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-sm text-slate-700">
                      {Object.entries(attendanceLabels)
                        .map(
                          ([key, label]) =>
                            `${label}: ${child.attendanceCounts[key] ?? 0}`,
                        )
                        .join(" · ")}
                    </p>

                    <ul className="divide-y divide-slate-200 text-sm">
                      {child.recentAttendance.map((r, index) => (
                        <li key={index} className="py-1">
                          {r.date} · {r.className} ·{" "}
                          <strong>
                            {attendanceLabels[r.status] ?? r.status}
                          </strong>
                          {r.note ? ` · ${r.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Học phí</h3>
                {child.invoices.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có hóa đơn.</p>
                ) : (
                  <ul className="divide-y divide-slate-200 text-sm">
                    {child.invoices.map((i) => (
                      <li key={i.invoiceNo} className="py-2">
                        <strong>{i.invoiceNo}</strong> · {i.courseName} · Phải
                        đóng {money(i.amount)} · Đã đóng {money(i.paidAmount)} ·
                        Còn {money(i.remainingAmount)} ·{" "}
                        {invoiceLabels[i.status] ?? i.status}
                        {i.dueDate ? ` · hạn ${i.dueDate}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
