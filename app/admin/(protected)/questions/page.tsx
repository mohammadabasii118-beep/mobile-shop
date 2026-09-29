import { db } from "@/lib/db";
import { answerQuestion } from "@/lib/actions/questions";

export const metadata = { title: "پرسش‌های محصولات | پنل مدیریت" };

export default async function AdminQuestionsPage() {
  const questions = await db.productQuestion.findMany({
    orderBy: [{ answeredAt: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
    take: 200,
  });
  const unanswered = questions.filter((q) => !q.answer).length;

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">پرسش‌های محصولات</h1>
      <p className="text-sm muted mb-6">{unanswered > 0 ? `${unanswered} پرسش بدون پاسخ` : "همه‌ی پرسش‌ها پاسخ داده شده‌اند"}</p>
      <div className="flex flex-col gap-4">
        {questions.map((q) => (
          <div key={q.id} className="surface border line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "#404040" }}>{q.product.name}</span>
              <span className="text-xs muted">{q.user.name}</span>
            </div>
            <p className="text-sm mb-3">{q.question}</p>
            {q.answer ? (
              <div className="rounded-lg surface2 p-3 text-sm">
                <span className="text-xs font-bold block mb-1">پاسخ فروشگاه:</span>
                {q.answer}
              </div>
            ) : (
              <form action={async (fd) => { "use server"; await answerQuestion(q.id, fd); }} className="flex flex-col gap-2">
                <textarea name="answer" required rows={2} placeholder="پاسخ خود را بنویسید…" className="w-full rounded-lg border line bg-transparent px-3 py-2 text-sm" />
                <button className="px-6 h-10 rounded-full text-white text-sm font-bold w-fit" style={{ background: "var(--ink)" }}>ارسال پاسخ</button>
              </form>
            )}
          </div>
        ))}
        {questions.length === 0 && <p className="text-center muted text-sm py-10">هنوز پرسشی ثبت نشده است.</p>}
      </div>
    </div>
  );
}
