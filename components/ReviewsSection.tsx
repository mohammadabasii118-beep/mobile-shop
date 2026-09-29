"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { submitReview } from "@/lib/actions/reviews";
import { fa } from "@/lib/format";

export type ReviewData = {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
};

function Stars({ value, size = "w-4 h-4" }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} از ۵ ستاره`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={size} fill={n <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.3l-5.8 3.2 1.1-6.5-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </div>
  );
}

function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`امتیاز ${n} از ۵`}
          className="p-0.5"
          style={{ color: n <= value ? "#e0a626" : "var(--muted)" }}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill={n <= value ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.3l-5.8 3.2 1.1-6.5-4.8-4.6 6.6-.9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({
  productId,
  reviews,
  average,
  count,
  myReview,
}: {
  productId: string;
  reviews: ReviewData[];
  average: number;
  count: number;
  myReview: { rating: number; comment: string } | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("rating", String(rating));
    fd.append("comment", comment);
    const res = await submitReview(productId, fd);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="mt-10 border-t line pt-8">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold">نظرات کاربران</h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={average} />
            <span className="text-sm muted">{average.toFixed(1)} از ۵ ({fa(count)} نظر)</span>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="surface border line rounded-2xl p-5 mb-8">
        <h3 className="font-bold text-sm mb-3">{myReview ? "ویرایش نظر شما" : "ثبت نظر شما"}</h3>
        <div className="mb-3">
          <RatingInput value={rating} onChange={setRating} />
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={session ? "تجربه‌ی خود از این محصول را بنویسید…" : "برای ثبت نظر ابتدا وارد حساب کاربری شوید"}
          rows={3}
          className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm outline-none resize-none"
        />
        {error && <p className="text-sm mt-2" style={{ color: "#a24e56" }}>{error}</p>}
        {done && !error && <p className="text-sm mt-2" style={{ color: "#3a7a4e" }}>نظر شما ثبت شد.</p>}
        <button
          disabled={loading || rating === 0 || comment.trim().length < 5}
          className="mt-3 px-6 h-11 rounded-full text-white font-bold text-sm disabled:opacity-60"
          style={{ background: "var(--ink)" }}
        >
          {loading ? "در حال ثبت…" : session ? "ثبت نظر" : "ورود و ثبت نظر"}
        </button>
      </form>

      {reviews.length === 0 ? (
        <p className="muted text-sm">هنوز نظری برای این محصول ثبت نشده — اولین نفر باشید.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {reviews.map((r) => (
            <div key={r.id} className="border-b line pb-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.userName}</span>
                  {r.isVerifiedPurchase && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#e8f3ec", color: "#3a7a4e" }}>
                      <Icon name="check" className="w-3 h-3" /> خرید تأییدشده
                    </span>
                  )}
                </div>
                <span className="text-xs muted">{new Date(r.createdAt).toLocaleDateString("fa-IR")}</span>
              </div>
              <Stars value={r.rating} size="w-3.5 h-3.5" />
              <p className="text-sm leading-7 mt-2 whitespace-pre-line">{r.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
