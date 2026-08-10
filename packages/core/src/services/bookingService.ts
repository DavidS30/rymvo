import { prisma } from "@repo/db";
import type { CreateBookingInput, BookingResponse, SanitizedBooking, PaymentStatus } from "../types";
import { validateScheduledAt } from "../utils";
import { getQuote } from "./quoteService";

async function findAvailableDriver(scheduledAtStr: string) {
  const scheduledAt = new Date(scheduledAtStr);
  const from = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);
  const to = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  const drivers = await prisma.user.findMany({ where: { role: "DRIVER", isAvailable: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  for (const driver of drivers) {
    const conflict = await prisma.booking.findFirst({ where: { driverId: driver.id, status: { notIn: ["CANCELLED"] }, scheduledAt: { gte: from, lte: to } }, select: { id: true } });
    if (!conflict) return driver.id;
  }
  return null;
}

function sanitizeBooking(booking: Record<string, unknown>): SanitizedBooking {
  const passenger = booking.passenger as Record<string, unknown> | undefined;
  const driver = booking.driver as Record<string, unknown> | undefined;
  const payment = booking.payment as Record<string, unknown> | undefined;

  return {
    id: booking.id as string,
    passengerId: booking.passengerId as string,
    passengerName: (passenger?.fullName as string) ?? "—",
    driverId: (booking.driverId as string) ?? null,
    driverName: (driver?.fullName as string) ?? null,
    originAddress: booking.originAddress as string,
    originLat: Number(booking.originLat),
    originLng: Number(booking.originLng),
    destAddress: booking.destAddress as string,
    destLat: Number(booking.destLat),
    destLng: Number(booking.destLng),
    scheduledAt: (booking.scheduledAt as Date).toISOString(),
    serviceType: booking.serviceType as SanitizedBooking["serviceType"],
    status: booking.status as SanitizedBooking["status"],
    baseFareCents: booking.baseFareCents as number,
    platformFeeCents: booking.platformFeeCents as number,
    distanceKm: booking.distanceKm as number,
    specialNotes: (booking.specialNotes as string) ?? undefined,
    createdAt: (booking.createdAt as Date).toISOString(),
    payment: payment ? { status: payment.status as PaymentStatus, amountCents: payment.amountCents as number } : null,
  };
}

export async function createBooking(
  input: CreateBookingInput & { passengerId: string }
): Promise<BookingResponse> {
  validateScheduledAt(input.scheduledAt);

  if (!input.originAddress.trim() || !input.destAddress.trim()) {
    throw new Error("Origen y destino son obligatorios");
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: input.passengerId },
  });
  if (!user) {
    throw new Error(
      "Usuario no encontrado. Asegurate de que el webhook de Clerk esté configurado."
    );
  }

  const driverId = await findAvailableDriver(input.scheduledAt);
  if (!driverId) throw new Error("No hay conductores disponibles para ese horario. Elegí otra fecha u hora.");

  const quote = await getQuote({
    originLat: input.originLat,
    originLng: input.originLng,
    destLat: input.destLat,
    destLng: input.destLng,
    serviceType: input.serviceType,
  });

  const booking = await prisma.booking.create({
    data: {
      passengerId: user.id,
      driverId,
      originAddress: input.originAddress,
      originLat: input.originLat,
      originLng: input.originLng,
      destAddress: input.destAddress,
      destLat: input.destLat,
      destLng: input.destLng,
      scheduledAt: new Date(input.scheduledAt),
      serviceType: input.serviceType,
      status: "PENDING",
      baseFareCents: quote.fareCents,
      platformFeeCents: quote.platformFeeCents,
      distanceKm: quote.distanceKm,
      specialNotes: input.specialNotes ?? null,
    },
  });

  return {
    id: booking.id,
    status: booking.status,
    totalCents: booking.baseFareCents + booking.platformFeeCents,
    scheduledAt: booking.scheduledAt.toISOString(),
    serviceType: booking.serviceType,
    originAddress: booking.originAddress,
    destAddress: booking.destAddress,
  };
}

export async function getBookingById(
  bookingId: string,
  userId: string,
  userRole: string
): Promise<SanitizedBooking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, passenger: true, driver: true },
  });

  if (!booking) {
    throw new Error("Reserva no encontrada");
  }

  const isOwner = booking.passengerId === userId || booking.driverId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new Error("No autorizado para ver esta reserva");
  }

  return sanitizeBooking(booking as unknown as Record<string, unknown>);
}

export async function listBookings(filters: {
  status?: string;
  driverId?: string;
  passengerId?: string;
  date?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(1, filters.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.driverId) {
    where.driverId = filters.driverId;
  }

  if (filters.passengerId) {
    where.passengerId = filters.passengerId;
  }

  if (filters.date) {
    const startOfDay = new Date(filters.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filters.date);
    endOfDay.setHours(23, 59, 59, 999);
    where.scheduledAt = { gte: startOfDay, lte: endOfDay };
  }

  const [data, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { payment: true, passenger: true, driver: true },
      orderBy: { scheduledAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { data: data.map((b) => sanitizeBooking(b as unknown as Record<string, unknown>)), page, limit, total };
}
