"use client";

import { type FormEvent, useState } from "react";

import { Panel } from "@/components/shared/Panel";
import { FormField, inputClass } from "@/components/shared/FormField";
import { Notice, type NoticeState } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/client-api";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (newPassword !== confirm) {
      setNotice({ type: "error", text: "Mật khẩu nhập lại không khớp." });
      return;
    }

    setSaving(true);

    const result = await callApi("/api/account/password", "POST", {
      currentPassword,
      newPassword,
    });

    setSaving(false);
    setNotice({ type: result.ok ? "success" : "error", text: result.message });

    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    }
  }

  return (
    <Panel title="Đổi mật khẩu">
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Mật khẩu hiện tại" htmlFor="current-password" required>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </FormField>

        <FormField
          label="Mật khẩu mới"
          htmlFor="new-password"
          required
          hint="Ít nhất 8 ký tự."
        >
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />
        </FormField>

        <FormField label="Nhập lại mật khẩu mới" htmlFor="confirm-password" required>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            required
          />
        </FormField>

        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Đổi mật khẩu"}
        </Button>
      </form>
    </Panel>
  );
}