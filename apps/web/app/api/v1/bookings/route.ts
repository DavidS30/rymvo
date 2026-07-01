import { auth } from "@clerk/nextjs/server";
import {
  createBooking,
  listBookings,
  createPaymentIntent,
} from "@repo/core/services";
import type { CreateBookingInput } from "@repo/core/types";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
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
    if (!(body as any)[field]) {
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
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
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
    const result = await listBookings({
      status: searchParams.get("status") ?? undefined,
      passengerId: searchParams.get("passengerId") ?? undefined,
      driverId: searchParams.get("driverId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
