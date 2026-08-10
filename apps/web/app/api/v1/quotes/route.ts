import { auth } from "@clerk/nextjs/server";
import { getQuote } from "@repo/core/services";
import { createRateLimiter } from "@repo/core/utils";
import type { ServiceType } from "@repo/core/types";

const rateLimiter = createRateLimiter(30, 60 * 1000);

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!rateLimiter.check(`quotes:${userId}`)) {
    return Response.json({ error: "Demasiadas solicitudes" }, { status: 429 });
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
        hours: Math.max(1, hours ? parseInt(hours) : 1),
      });
      return Response.json(quote);
    } catch (error) {
      console.error("[quotes] Error getting HOURLY quote:", error);
      return Response.json(
        { error: "Error interno del servidor" },
        { status: 500 }
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
    console.error("[quotes] Error getting quote:", error);
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
