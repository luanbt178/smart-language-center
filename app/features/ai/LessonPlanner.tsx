"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField, inputClass } from "@/components/shared/FormField";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { PageHeader } from "@/components/shared/PageHeader";

type ClassOption = { id: string; code: string; name: string; status: string };

const FOCUS_OPTIONS = [
  { value: "GENERAL", label: "Tổng hợp" },
  { value: "LISTENING", label: "Nghe" },
  { value: "SPEAKING", label: "Nói" },
  { value: "READING", label: "Đọc" },
  { value: "WRITING", label: "Viết" },
  { value: "VOCABULARY", label: "Từ vựng" },
  { value: "GRAMMAR", label: "Ngữ pháp" },
];

const MINUTE_OPTIONS = [30, 45, 60, 90, 120];

export default function LessonPlanner() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState("GENERAL");
  const [minutes, setMinutes] = useState("90");
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    async function loadClasses() {
      try {
        const response = await fetch("/api/classes", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Không thể tải danh sách lớp.");
        }

        setClasses(
          (data.classes as ClassOption[]).filter((c) => c.status === "ACTIVE"),
        );
      } catch (error) {
        setNotice({
          type: "error",
          text:
            error instanceof Error ? error.message : "Không thể tải dữ liệu.",
        });
      } finally {
        setLoadingClasses(false);
      }
    }

    void loadClasses();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ai/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          topic,
          focus,
          minutes: Number(minutes),
          notes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Không thể soạn giáo án.");
      }

      setResult(data.text);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể soạn giáo án.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setNotice({ type: "success", text: "Đã sao chép giáo án." });
    } catch {
      setNotice({
        type: "error",
        text: "Không sao chép được, hãy bôi đen và copy thủ công.",
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl text-slate-900">
      <PageHeader
        title="Trợ lý giảng dạy AI"
        description="Gợi ý giáo án và bài tập cho buổi học. Nhận xét học viên nằm trong trang Đánh giá & điểm số."
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <FormField label="Lớp" htmlFor="ai-class" required>
          <select
            id="ai-class"
            className={inputClass}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            required
          >
            <option value="">
              {loadingClasses ? "Đang tải lớp..." : "-- Chọn lớp --"}
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Chủ đề buổi học" htmlFor="ai-topic" required>
          <input
            id="ai-topic"
            className={inputClass}
            value={topic}
            maxLength={200}
            placeholder="Ví dụ: Thì hiện tại hoàn thành"
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Trọng tâm" htmlFor="ai-focus">
          <select
            id="ai-focus"
            className={inputClass}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          >
            {FOCUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Thời lượng" htmlFor="ai-minutes">
          <select
            id="ai-minutes"
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} phút
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Ghi chú thêm (không bắt buộc)"
          htmlFor="ai-notes"
          className="sm:col-span-2"
        >
          <textarea
            id="ai-notes"
            className={`${inputClass} h-24 py-2`}
            value={notes}
            maxLength={500}
            placeholder="Ví dụ: lớp hay nhầm giữa 'for' và 'since', cần nhiều hoạt động nói theo cặp"
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || classId === ""}>
            <Sparkles />
            {busy ? "Đang soạn..." : "Soạn giáo án"}
          </Button>
        </div>
      </form>

      {result && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Giáo án gợi ý</h2>

            <Button type="button" variant="outline" onClick={() => void copyResult()}>
              <Copy />
              Sao chép
            </Button>
          </div>

          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Nội dung do AI tạo, chỉ để tham khảo. Hãy kiểm tra và chỉnh sửa
            trước khi dùng trên lớp.
          </p>

          <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {result}
          </div>
        </section>
      )}
    </div>
  );
}