import { prisma } from "@repo/db";
import type { CreateBookingInput, BookingResponse } from "../types";
import { validateScheduledAt } from "../utils";
import { checkAvailability } from "./availabilityService";
import { getQuote } from "./quoteService";

export async function createBooking(
  input: CreateBookingInput & { passengerId: string }
): Promise<BookingResponse> {
  validateScheduledAt(input.scheduledAt);

  if (!input.originAddress.trim() || !input.destAddress.trim()) {
    throw new Error("Origen y destino son obligatorios");
  }

  const available = await checkAvailability(input.scheduledAt);
  if (!available) {
    throw new Error("No hay disponibilidad para el horario seleccionado");
  }

  const quote = await getQuote({
    originLat: input.originLat,
    originLng: input.originLng,
    destLat: input.destLat,
    destLng: input.destLng,
    serviceType: input.serviceType,
  });

  const booking = await prisma.booking.create({
    data: {
      passengerId: input.passengerId,
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
) {
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

  return booking;
}

export async function listBookings(filters: {
  status?: string;
  driverId?: string;
  passengerId?: string;
  date?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
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
      include: { payment: true, passenger: true },
      orderBy: { scheduledAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return { data, page, limit, total };
}
