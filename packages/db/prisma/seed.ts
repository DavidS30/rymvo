import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed FareRules — precios basados en arquitectura §8
  const rules = [
    {
      serviceType: "AIRPORT",
      baseFareCents: 5000, // $50.00
      pricePerKmCents: 250, // $2.50/km
      pricePerHourCents: null,
      platformFeePct: 7.0,
    },
    {
      serviceType: "HOURLY",
      baseFareCents: 0,
      pricePerKmCents: 0,
      pricePerHourCents: 7500, // $75.00/hora
      platformFeePct: 7.0,
    },
    {
      serviceType: "EVENT",
      baseFareCents: 10000, // $100.00
      pricePerKmCents: 300, // $3.00/km
      pricePerHourCents: null,
      platformFeePct: 10.0,
    },
  ];

  for (const rule of rules) {
    await prisma.fareRule.upsert({
      where: { serviceType: rule.serviceType as "AIRPORT" | "HOURLY" | "EVENT" },
      update: rule,
      create: rule,
    });
  }

  console.log("FareRules seeded:", rules.map((r) => r.serviceType).join(", "));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
