import type { FareRule } from "../types";
import { PLATFORM_FEE_PCT } from "../constants";

export function calcFare(
  rule: FareRule,
  distanceKm: number
): {
  fareCents: number;
  platformFeeCents: number;
  totalCents: number;
} {
  const baseFare = rule.baseFareCents;
  const distanceFare = Math.round(distanceKm * rule.pricePerKmCents);
  const fare = baseFare + distanceFare;
  const platformFeePct = rule.platformFeePct ?? PLATFORM_FEE_PCT;
  const platformFee = Math.round(fare * (platformFeePct / 100));
  return {
    fareCents: fare,
    platformFeeCents: platformFee,
    totalCents: fare + platformFee,
  };
}

export function calcHourlyFare(
  rule: FareRule,
  hours: number
): {
  fareCents: number;
  platformFeeCents: number;
  totalCents: number;
} {
  const pricePerHour = rule.pricePerHourCents ?? 0;
  const fare = Math.round(hours * pricePerHour);
  const platformFeePct = rule.platformFeePct ?? PLATFORM_FEE_PCT;
  const platformFee = Math.round(fare * (platformFeePct / 100));
  return {
    fareCents: fare,
    platformFeeCents: platformFee,
    totalCents: fare + platformFee,
  };
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCentsToDisplay(cents: number): string {
  return `$${centsToDollars(cents)}`;
}

export function validateScheduledAt(dateStr: string): void {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Fecha inválida");
  }
  if (date <= new Date()) {
    throw new Error("La fecha debe ser futura");
  }
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= maxRequests) return false;
      entry.count++;
      return true;
    },
  };
}
