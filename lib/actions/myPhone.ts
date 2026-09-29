"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("ابتدا وارد حساب کاربری شوید");
  return session.user.id as string;
}

export async function getMyPhone() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { myBrandId: true, myPhoneModelId: true, myBrand: { select: { name: true } }, myPhoneModel: { select: { name: true } } },
  });
  if (!user?.myPhoneModelId) return null;
  return {
    brandId: user.myBrandId,
    brandName: user.myBrand?.name || null,
    phoneModelId: user.myPhoneModelId,
    phoneModelName: user.myPhoneModel?.name || null,
  };
}

export async function setMyPhone(brandId: string, phoneModelId: string) {
  const userId = await requireUserId();
  if (!brandId || !phoneModelId) throw new Error("لطفاً برند و مدل را انتخاب کنید");

  // Validate the model actually belongs to the chosen brand — otherwise a
  // crafted request could save a mismatched pair.
  const model = await db.phoneModel.findUnique({ where: { id: phoneModelId } });
  if (!model || model.brandId !== brandId) throw new Error("مدل انتخاب‌شده معتبر نیست");

  await db.user.update({ where: { id: userId }, data: { myBrandId: brandId, myPhoneModelId: phoneModelId } });
  revalidatePath("/account");
  revalidatePath("/", "layout");
}

export async function clearMyPhone() {
  const userId = await requireUserId();
  await db.user.update({ where: { id: userId }, data: { myBrandId: null, myPhoneModelId: null } });
  revalidatePath("/account");
  revalidatePath("/", "layout");
}
