import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { createRateLimiter } from "@repo/core/utils";

const reportsRateLimiter = createRateLimiter(20, 60 * 1000);

export async function GET(req: Request) {
  const { userId } = await auth(); if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } }); if (user?.role !== "ADMIN") return Response.json({ error: "Solo administradores" }, { status: 403 });

  if (!reportsRateLimiter.check(`reports:${userId}`)) {
    return Response.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const [total, completed, cancelled, revenue, byService] = await Promise.all([
    prisma.booking.count(), prisma.booking.count({ where: { status: "COMPLETED" } }), prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.aggregate({ _sum: { baseFareCents: true, platformFeeCents: true }, where: { status: { notIn: ["CANCELLED"] } } }),
    prisma.booking.groupBy({ by: ["serviceType"], _count: { _all: true }, _sum: { baseFareCents: true }, orderBy: { serviceType: "asc" } }),
  ]);
  return Response.json({ data: { total, completed, cancelled, revenueCents: (revenue._sum.baseFareCents ?? 0) + (revenue._sum.platformFeeCents ?? 0), byService } }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
