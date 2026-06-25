import { Webhook } from "svix";
import { headers } from "next/headers";
import { prisma } from "@repo/db";

type ClerkUserEvent = {
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string;
    last_name: string;
    phone_numbers: Array<{ phone_number: string }>;
  };
  type: "user.created" | "user.updated" | "user.deleted";
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return Response.json(
      { error: "CLERK_WEBHOOK_SECRET no configurado" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json(
      { error: "Faltan headers svix" },
      { status: 400 }
    );
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return Response.json(
      { error: "Firma inválida" },
      { status: 401 }
    );
  }

  const event = payload as ClerkUserEvent;

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const email = event.data.email_addresses[0]?.email_address;
        if (!email) {
          return Response.json(
            { error: "Email no encontrado en el evento" },
            { status: 400 }
          );
        }

        const fullName = [event.data.first_name, event.data.last_name]
          .filter(Boolean)
          .join(" ");

        await prisma.user.upsert({
          where: { clerkUserId: event.data.id },
          create: {
            clerkUserId: event.data.id,
            email,
            fullName: fullName || email,
            phone: event.data.phone_numbers[0]?.phone_number ?? null,
          },
          update: {
            email,
            fullName: fullName || email,
            phone: event.data.phone_numbers[0]?.phone_number ?? null,
          },
        });

        return Response.json({ success: true });
      }

      case "user.deleted": {
        await prisma.user.deleteMany({
          where: { clerkUserId: event.data.id },
        });

        return Response.json({ success: true });
      }

      default:
        return Response.json(
          { error: `Evento no soportado: ${event.type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[clerk-webhook] Error:", error);
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
