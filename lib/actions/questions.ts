"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireStaffPermission } from "./guard";
import { questionSchema, questionAnswerSchema } from "@/lib/validation";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("برای پرسیدن سوال ابتدا وارد حساب کاربری شوید");
  return session.user.id as string;
}

/** A logged-in user asks a real question about a product — separate from
 * reviews, and never pre-answered or auto-filled. */
export async function askQuestion(productId: string, formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const data = questionSchema.parse(raw);

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new Error("محصول پیدا نشد");

  await db.productQuestion.create({ data: { productId, userId, question: data.question } });
  revalidatePath(`/product`);
  revalidatePath(`/admin/questions`);
}

/** Answering a question is treated the same as support (an ADMIN, or a
 * STAFF account with the "SUPPORT" permission) — it's customer-facing
 * communication, exactly like a support reply. */
export async function answerQuestion(questionId: string, formData: FormData) {
  await requireStaffPermission("SUPPORT");
  const raw = Object.fromEntries(formData.entries());
  const data = questionAnswerSchema.parse(raw);

  const question = await db.productQuestion.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!question) throw new Error("سوال پیدا نشد");

  await db.productQuestion.update({
    where: { id: questionId },
    data: { answer: data.answer, answeredAt: new Date() },
  });
  revalidatePath(`/product`);
  revalidatePath(`/admin/questions`);
}

export async function getProductQuestions(productId: string) {
  const questions = await db.productQuestion.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  return questions.map((q) => ({
    id: q.id,
    userName: q.user.name,
    question: q.question,
    answer: q.answer,
    createdAt: q.createdAt.toISOString(),
  }));
}
