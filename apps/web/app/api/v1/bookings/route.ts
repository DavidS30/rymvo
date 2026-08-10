import { auth } from "@clerk/nextjs/server";
import {
  createBooking,
  listBookings,
  createPaymentIntent,
} from "@repo/core/services";
import type { CreateBookingInput } from "@repo/core/types";
import { createRateLimiter } from "@repo/core/utils";
import { prisma } from "@repo/db";

const bookingsRateLimiter = createRateLimiter(10, 60 * 1000);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!bookingsRateLimiter.check(`bookings:${userId}`)) {
    return Response.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  let body: CreateBookingInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const required = [
    "originAddress",
    "originLat",
    "originLng",
    "destAddress",
    "destLat",
    "destLng",
    "scheduledAt",
    "serviceType",
  ];

  for (const field of required) {
    const value = (body as any)[field];
    if (value === undefined || value === null || value === "") {
      return Response.json(
        { error: `Falta campo requerido: ${field}` },
        { status: 400 }
      );
    }
  }

  const validTypes = ["AIRPORT", "HOURLY", "EVENT"];
  if (!validTypes.includes(body.serviceType)) {
    return Response.json(
      { error: "serviceType debe ser AIRPORT, HOURLY o EVENT" },
      { status: 400 }
    );
  }

  const lat = Number(body.originLat);
  const lng = Number(body.originLng);
  const dLat = Number(body.destLat);
  const dLng = Number(body.destLng);
  if (!isFinite(lat) || lat < -90 || lat > 90 || !isFinite(lng) || lng < -180 || lng > 180) {
    return Response.json({ error: "Coordenadas de origen inválidas" }, { status: 400 });
  }
  if (!isFinite(dLat) || dLat < -90 || dLat > 90 || !isFinite(dLng) || dLng < -180 || dLng > 180) {
    return Response.json({ error: "Coordenadas de destino inválidas" }, { status: 400 });
  }

  if (body.specialNotes && body.specialNotes.length > 280) {
    return Response.json(
      { error: "specialNotes máximo 280 caracteres" },
      { status: 400 }
    );
  }

  try {
    const booking = await createBooking({ ...body, passengerId: userId });

    const payment = await createPaymentIntent(
      booking.id,
      booking.totalCents
    );

    return Response.json(payment, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    const isUserError = message.includes("No hay") || message.includes("Fecha") || message.includes("Origen") || message.includes("Usuario");
    console.error("[bookings] Error creating booking:", error);
    return Response.json(
      { error: isUserError ? message : "Error interno del servidor" },
      { status: isUserError ? 400 : 500 }
    );
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  try {
    const currentUser = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { id: true, role: true } });
    if (!currentUser) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    const result = await listBookings({
      status: searchParams.get("status") ?? undefined,
      passengerId: currentUser.role === "PASSENGER" ? currentUser.id : searchParams.get("passengerId") ?? undefined,
      driverId: currentUser.role === "DRIVER" ? currentUser.id : searchParams.get("driverId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: Math.min(searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20, 100),
    });

    return Response.json(result);
  } catch (error) {
    console.error("[bookings] Error listing bookings:", error);
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
