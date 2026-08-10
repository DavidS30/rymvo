import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";

async function getDriver() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findFirst({ where: { clerkUserId: userId, role: "DRIVER" }, select: { id: true, isAvailable: true } });
}

export async function GET() {
  const driver = await getDriver();
  if (!driver) return Response.json({ error: "Solo conductores" }, { status: 403 });
  return Response.json({ isAvailable: driver.isAvailable });
}

export async function PATCH(req: Request) {
  const driver = await getDriver();
  if (!driver) return Response.json({ error: "Solo conductores" }, { status: 403 });
  const body = await req.json().catch(() => null) as { isAvailable?: boolean } | null;
  if (typeof body?.isAvailable !== "boolean") return Response.json({ error: "isAvailable debe ser boolean" }, { status: 400 });
  const updated = await prisma.user.update({ where: { id: driver.id }, data: { isAvailable: body.isAvailable }, select: { isAvailable: true } });
  return Response.json(updated);
}
