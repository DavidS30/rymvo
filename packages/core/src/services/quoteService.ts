import { prisma } from "@repo/db";
import { calcFare, calcHourlyFare, haversineDistance } from "../utils";
import type { QuoteInput, QuoteResponse } from "../types";

export async function getQuote(input: QuoteInput): Promise<QuoteResponse> {
  const rule = await prisma.fareRule.findFirst({
    where: {
      serviceType: input.serviceType,
      isActive: true,
    },
  });

  if (!rule) {
    throw new Error(`No hay tarifa activa para ${input.serviceType}`);
  }

  // HOURLY: tarifa basada en horas, no en distancia
  if (input.serviceType === "HOURLY") {
    const hours = input.hours ?? 1;
    const result = calcHourlyFare(
      {
        id: rule.id,
        serviceType: rule.serviceType,
        baseFareCents: rule.baseFareCents,
        pricePerKmCents: rule.pricePerKmCents,
        pricePerHourCents: rule.pricePerHourCents ?? undefined,
        platformFeePct: Number(rule.platformFeePct),
        isActive: rule.isActive,
      },
      hours
    );

    return {
      fareCents: result.fareCents,
      platformFeeCents: result.platformFeeCents,
      totalCents: result.totalCents,
      distanceKm: 0,
      durationMin: hours * 60,
    };
  }

  // AIRPORT / EVENT: tarifa basada en distancia
  const { distanceKm, durationMin } = await getDistanceAndDuration(
    input.originLat,
    input.originLng,
    input.destLat,
    input.destLng
  );

  const result = calcFare(
    {
      id: rule.id,
      serviceType: rule.serviceType,
      baseFareCents: rule.baseFareCents,
      pricePerKmCents: rule.pricePerKmCents,
      pricePerHourCents: rule.pricePerHourCents ?? undefined,
      platformFeePct: Number(rule.platformFeePct),
      isActive: rule.isActive,
    },
    distanceKm
  );

  return {
    fareCents: result.fareCents,
    platformFeeCents: result.platformFeeCents,
    totalCents: result.totalCents,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
  };
}

async function getDistanceAndDuration(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distanceKm: number; durationMin: number }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey && apiKey !== "placeholder") {
    try {
      const result = await fetchGoogleDistanceMatrix(
        apiKey,
        originLat,
        originLng,
        destLat,
        destLng
      );
      return result;
    } catch {
      // Si falla la API, usar Haversine como fallback
    }
  }

  const distanceKm = haversineDistance(originLat, originLng, destLat, destLng);
  const durationMin = Math.round((distanceKm / 40) * 60);

  return { distanceKm, durationMin };
}

async function fetchGoogleDistanceMatrix(
  apiKey: string,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distanceKm: number; durationMin: number }> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${originLat},${originLng}`);
  url.searchParams.set("destinations", `${destLat},${destLng}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("units", "metric");

  const response = await fetch(url.toString());
  const data = (await response.json()) as {
    status: string;
    rows: Array<{
      elements: Array<{
        status: string;
        distance?: { value: number };
        duration?: { value: number };
      }>;
    }>;
  };

  if (data.status !== "OK") {
    throw new Error(`Google Distance Matrix error: ${data.status}`);
  }

  const element = data.rows[0]?.elements[0];
  if (!element || element.status !== "OK") {
    throw new Error(`No route found: ${element?.status ?? "unknown"}`);
  }

  return {
    distanceKm: Math.round((element.distance!.value / 1000) * 10) / 10,
    durationMin: Math.round(element.duration!.value / 60),
  };
}
