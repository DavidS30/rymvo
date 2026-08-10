import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";

async function admin() { const { userId } = await auth(); if (!userId) return false; const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } }); return user?.role === "ADMIN"; }
export async function GET() { if (!(await admin())) return Response.json({ error: "Solo administradores" }, { status: 403 }); return Response.json({ data: await prisma.fareRule.findMany({ orderBy: { serviceType: "asc" } }) }); }
const TARIFF_ALLOWED_FIELDS = ["baseFareCents", "pricePerKmCents", "pricePerHourCents", "platformFeePct", "isActive"] as const;

export async function PATCH(req: Request) {
  if (!(await admin())) return Response.json({ error: "Solo administradores" }, { status: 403 });
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.id) return Response.json({ error: "id es requerido" }, { status: 400 });

    const data: Record<string, unknown> = {};
    for (const field of TARIFF_ALLOWED_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const rule = await prisma.fareRule.update({ where: { id: body.id }, data });
    return Response.json({ data: rule });
  } catch {
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
