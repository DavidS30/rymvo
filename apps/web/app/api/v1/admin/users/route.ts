import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Solo administradores" }, { status: 403 });
  const users = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true }, orderBy: { createdAt: "desc" } });
  return Response.json({ data: users });
}

const VALID_ROLES = ["PASSENGER", "DRIVER", "ADMIN"] as const;

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Solo administradores" }, { status: 403 });
  try {
    const body = await req.json().catch(() => null) as { userId?: string; role?: string } | null;
    if (!body?.userId || !body.role) return Response.json({ error: "userId y role son requeridos" }, { status: 400 });
    if (!(VALID_ROLES as readonly string[]).includes(body.role)) return Response.json({ error: `Rol inválido. Usar: ${VALID_ROLES.join(", ")}` }, { status: 400 });

    const adminUser = await prisma.user.findUnique({ where: { clerkUserId: (await auth()).userId ?? "" }, select: { id: true } });
    if (adminUser && adminUser.id === body.userId) return Response.json({ error: "No puedes cambiarte tu propio rol" }, { status: 400 });

    const user = await prisma.user.update({ where: { id: body.userId }, data: { role: body.role as "PASSENGER" | "DRIVER" | "ADMIN" }, select: { id: true, fullName: true, email: true, role: true } });
    return Response.json({ data: user });
  } catch {
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
