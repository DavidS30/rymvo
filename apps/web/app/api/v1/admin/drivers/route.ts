import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } });
  return user?.role === "ADMIN" ? user : null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Solo administradores" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1);
  const limit = Math.min(Math.max(1, searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50), 100);
  const skip = (page - 1) * limit;

  const [drivers, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: "DRIVER" },
      select: { id: true, fullName: true, email: true, phone: true, isAvailable: true, _count: { select: { bookingsAsDriver: true } } },
      orderBy: { fullName: "asc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: { role: "DRIVER" } }),
  ]);

  const data = drivers.map(({ _count, ...driver }) => ({ ...driver, assignedCount: _count.bookingsAsDriver }));
  return Response.json({ data, page, limit, total });
}
