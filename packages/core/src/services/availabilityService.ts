import { prisma } from "@repo/db";

export async function checkAvailability(
  scheduledAtStr: string,
  driverId?: string
): Promise<boolean> {
  const scheduledAt = new Date(scheduledAtStr);
  const minus3h = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);
  const plus3h = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    status: { notIn: ["CANCELLED"] },
    scheduledAt: { gte: minus3h, lte: plus3h },
  };

  if (driverId) {
    where.driverId = driverId;
  }

  const conflicting = await prisma.booking.count({ where });

  return conflicting === 0;
}

export async function getAvailableSlots(date: string): Promise<string[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["CANCELLED"] },
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    },
    select: { scheduledAt: true },
  });

  const blockedHours = new Set<number>();
  for (const b of bookings) {
    const h = b.scheduledAt.getHours();
    for (let i = h - 2; i <= h + 2; i++) {
      if (i >= 0 && i <= 23) blockedHours.add(i);
    }
  }

  const now = new Date();
  const isToday = date === now.toISOString().split("T")[0];
  const currentHour = now.getHours();

  const allSlots = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00",
  ];

  return allSlots.filter((slot) => {
    const hour = parseInt(slot.split(":")[0]);
    if (blockedHours.has(hour)) return false;
    if (isToday && hour <= currentHour) return false;
    return true;
  });
}
