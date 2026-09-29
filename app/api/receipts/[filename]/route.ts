import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const RECEIPTS_DIR = path.join(process.cwd(), "private-uploads", "receipts");
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

export async function GET(req: Request, { params }: { params: { filename: string } }) {
  const filename = params.filename;
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  const receipt = await db.cardTransferReceipt.findFirst({
    where: { imageFile: filename },
    include: { order: true },
  });
  if (!receipt) return new NextResponse("Not found", { status: 404 });

  const session = await getServerSession(authOptions);
  const order = receipt.order;
  const isAdmin = session?.user?.role === "ADMIN";

  if (order.userId) {
    // Order belongs to a registered account — only that account or an admin may view it.
    const isOwner = session?.user?.id === order.userId;
    if (!isOwner && !isAdmin) return new NextResponse("Forbidden", { status: 403 });
  } else if (!isAdmin) {
    // Guest order — only an admin, or a request carrying the exact
    // guestToken issued for this order, may view the receipt. The order id
    // (or the receipt filename, which embeds it) is never sufficient alone.
    if (!order.guestToken || !token || token !== order.guestToken) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  try {
    const buffer = await readFile(path.join(RECEIPTS_DIR, filename));
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
