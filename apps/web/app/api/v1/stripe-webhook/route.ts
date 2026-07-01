import { handlePaymentSucceeded, handlePaymentFailed } from "@repo/core/services";
import { getStripe } from "@repo/core/lib";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const body = await req.text();

  const stripe = getStripe();

  if (stripe && webhookSecret && webhookSecret !== "whsec_placeholder") {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature!,
        webhookSecret
      );

      return await handleStripeEvent(event as { type: string; data: { object: { id: string } } });
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return Response.json({ error: "Firma inválida" }, { status: 400 });
    }
  }

  try {
    const event = JSON.parse(body) as { type: string; data: { object: { id: string } } };
    return await handleStripeEvent(event);
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }
}

async function handleStripeEvent(event: { type: string; data: { object: { id: string } } }) {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object.id);
      return Response.json({ received: true });

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object.id);
      return Response.json({ received: true });

    default:
      return Response.json({ message: `Evento no manejado: ${event.type}` }, { status: 200 });
  }
}
