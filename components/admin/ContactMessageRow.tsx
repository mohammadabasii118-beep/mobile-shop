"use client";
import { useState } from "react";
import { markContactMessageRead } from "@/lib/actions/contactMessages";

export default function ContactMessageRow({ message }: { message: any }) {
  const [isRead, setIsRead] = useState(message.isRead);

  return (
    <div className="surface border line rounded-xl p-4" style={isRead ? undefined : { borderColor: "var(--ink)" }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-sm">{message.name}</span>
          <span className="text-xs muted mr-2">{message.email}{message.phone ? ` · ${message.phone}` : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs muted">{new Date(message.createdAt).toLocaleString("fa-IR")}</span>
          <button
            onClick={() => { const next = !isRead; setIsRead(next); markContactMessageRead(message.id, next); }}
            className="text-xs font-bold underline underline-offset-4"
          >
            {isRead ? "علامت‌گذاری به‌عنوان خوانده‌نشده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}
          </button>
        </div>
      </div>
      <p className="text-sm leading-7">{message.message}</p>
    </div>
  );
}
