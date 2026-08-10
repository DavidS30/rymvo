import { auth } from "@clerk/nextjs/server";
import { getBookingById } from "@repo/core/services";
import { prisma } from "@repo/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { id: true, role: true } });
    if (!user) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    const booking = await getBookingById(id, user.id, user.role);
    return Response.json(booking);
  } catch (error) {
    const message = (error as Error).message;
    console.error("[bookings] Error getting booking:", error);
    if (message.includes("No autorizado")) {
      return Response.json({ error: message }, { status: 403 });
    }
    if (message.includes("no encontrada")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
