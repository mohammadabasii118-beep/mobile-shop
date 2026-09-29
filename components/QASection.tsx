"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { askQuestion } from "@/lib/actions/questions";

export type QuestionData = {
  id: string;
  userName: string;
  question: string;
  answer: string | null;
  createdAt: string;
};

/** Product Q&A — deliberately separate UI from ReviewsSection: this is a
 * question needing a real answer from the store, not a star rating. A new
 * question always starts unanswered; nothing here is pre-filled. */
export default function QASection({ productId, questions }: { productId: string; questions: QuestionData[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      router.push("/login");
      return;
    }
    setPending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("question", text);
      await askQuestion(productId, fd);
      setText("");
      setSuccess(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "خطا در ثبت سوال");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold mb-4">پرسش و پاسخ</h2>

      <form onSubmit={submit} className="mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          minLength={5}
          rows={2}
          placeholder="سوالی درباره این محصول دارید؟"
          className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm"
        />
        {error && <p className="text-xs mt-2" style={{ color: "#a24e56" }}>{error}</p>}
        {success && <p className="text-xs mt-2" style={{ color: "#3a7d4f" }}>سوال شما ثبت شد و به‌زودی پاسخ داده می‌شود.</p>}
        <button disabled={pending} className="mt-2 px-6 h-10 rounded-full text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--ink)" }}>
          {pending ? "در حال ارسال…" : "پرسیدن سوال"}
        </button>
      </form>

      {questions.length === 0 ? (
        <p className="text-sm muted">هنوز سوالی برای این محصول ثبت نشده است.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="border-b line pb-4">
              <p className="text-sm font-medium mb-1">س: {q.question}</p>
              {q.answer ? (
                <p className="text-sm muted leading-7">ج: {q.answer}</p>
              ) : (
                <p className="text-xs muted">در انتظار پاسخ فروشگاه</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
