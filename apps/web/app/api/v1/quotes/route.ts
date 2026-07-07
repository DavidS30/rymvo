import { auth } from "@clerk/nextjs/server";
import { getQuote } from "@repo/core/services";
import type { ServiceType } from "@repo/core/types";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const originLat = searchParams.get("originLat");
  const originLng = searchParams.get("originLng");
  const destLat = searchParams.get("destLat");
  const destLng = searchParams.get("destLng");
  const serviceType = searchParams.get("serviceType");
  const hours = searchParams.get("hours");

  if (!serviceType) {
    return Response.json(
      { error: "Falta parámetro: serviceType" },
      { status: 400 }
    );
  }

  const validServiceTypes: ServiceType[] = ["AIRPORT", "HOURLY", "EVENT"];
  if (!validServiceTypes.includes(serviceType as ServiceType)) {
    return Response.json(
      { error: "serviceType debe ser AIRPORT, HOURLY o EVENT" },
      { status: 400 }
    );
  }

  // HOURLY: no requiere coordenadas, solo horas
  if (serviceType === "HOURLY") {
    try {
      const quote = await getQuote({
        originLat: 0,
        originLng: 0,
        destLat: 0,
        destLng: 0,
        serviceType: "HOURLY",
        hours: hours ? parseInt(hours) : 1,
      });
      return Response.json(quote);
    } catch (error) {
      return Response.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
  }

  // AIRPORT / EVENT: requieren coordenadas
  if (!originLat || !originLng || !destLat || !destLng) {
    return Response.json(
      { error: "Faltan parámetros: originLat, originLng, destLat, destLng" },
      { status: 400 }
    );
  }

  try {
    const quote = await getQuote({
      originLat: parseFloat(originLat),
      originLng: parseFloat(originLng),
      destLat: parseFloat(destLat),
      destLng: parseFloat(destLng),
      serviceType: serviceType as ServiceType,
    });

    return Response.json(quote);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
