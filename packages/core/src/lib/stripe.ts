import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "../constants";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = STRIPE_SECRET_KEY;
  if (!key || key === "sk_test_placeholder") {
    return null;
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-06-30.acacia" as any,
    });
  }

  return stripeInstance;
}
