"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";

import { StatCard } from "@/components/shared/StatCard";
import { LoadingState } from "@/components/shared/states";
import { Notice } from "@/components/shared/Notice";

type Report = {
  generatedAt: string;
  counts: { students: number; enrollments: number; classes: number };
  leads: Record<string, number>;
  revenue: { collectedThisMonth: number; outstanding: number; overdue: number };
  attendance: Record<string, number>;
};

type Attention = { text: string; href: string; action: string };

function money(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

export default function DashboardStats() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/reports", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Không thể tải số liệu.");
        }

        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải số liệu.");
      }
    }

    void load();
  }, []);

  if (error) {
    return <Notice notice={{ type: "error", text: error }} />;
  }

  if (!report) {
    return <LoadingState text="Đang tải số liệu..." />;
  }

  const attendanceTotal = Object.values(report.attendance).reduce(
    (sum, value) => sum + value,
    0,
  );
  const attended =
    (report.attendance.PRESENT ?? 0) + (report.attendance.LATE ?? 0);
  const rate =
    attendanceTotal === 0 ? null : Math.round((attended / attendanceTotal) * 100);

  const attention: Attention[] = [];

  if (report.revenue.overdue > 0) {
    attention.push({
      text: `Có ${money(report.revenue.overdue)} học phí quá hạn.`,
      href: "/payments",
      action: "Xem hóa đơn",
    });
  }

  if ((report.leads.NEW ?? 0) > 0) {
    attention.push({
      text: `Có ${report.leads.NEW} khách hàng mới chưa được liên hệ.`,
      href: "/sales/leads",
      action: "Xem khách hàng",
    });
  }

  if (rate !== null && rate < 80) {
    attention.push({
      text: `Tỷ lệ tham dự đang thấp (${rate}%).`,
      href: "/attendance",
      action: "Xem điểm danh",
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tổng quan hôm nay</h2>
          <p className="mt-1 text-sm text-slate-500">
            Trong phạm vi chi nhánh của bạn · cập nhật {report.generatedAt}
          </p>
        </div>

        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          Báo cáo đầy đủ
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Học viên đang học"
          value={report.counts.students}
          icon={Users}
          tone="blue"
        />
        <StatCard
          label="Lớp đang mở"
          value={report.counts.classes}
          icon={GraduationCap}
          tone="green"
        />
        <StatCard
          label="Đã thu tháng này"
          value={money(report.revenue.collectedThisMonth)}
          icon={Wallet}
          tone="green"
        />
        <StatCard
          label="Nợ quá hạn"
          value={money(report.revenue.overdue)}
          icon={CircleAlert}
          tone={report.revenue.overdue > 0 ? "red" : "slate"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Cần chú ý</h3>

        {attention.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Chưa có việc nào cần chú ý.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {attention.map((item) => (
              <li
                key={item.text}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span className="text-slate-700">{item.text}</span>
                <Link
                  href={item.href}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}