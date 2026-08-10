import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });
    const admin = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } });
    if (admin?.role !== "ADMIN") return Response.json({ error: "Solo administradores" }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => null) as { driverId?: string | null } | null;
    if (!body || body.driverId === undefined) return Response.json({ error: "driverId es requerido" }, { status: 400 });
    if (body.driverId) {
      const driver = await prisma.user.findFirst({ where: { id: body.driverId, role: "DRIVER" }, select: { id: true } });
      if (!driver) return Response.json({ error: "Conductor inválido" }, { status: 400 });
    }
    const booking = await prisma.booking.update({ where: { id }, data: { driverId: body.driverId || null }, include: { driver: { select: { id: true, fullName: true } } } });
    return Response.json({ data: booking });
  } catch {
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
