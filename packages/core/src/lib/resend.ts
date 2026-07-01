import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_placeholder") {
    return null;
  }

  if (!resendInstance) {
    resendInstance = new Resend(key);
  }

  return resendInstance;
}
