import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "@repo/ui-web/styles.css";

export const metadata: Metadata = {
  title: {
    default: "Rymvo | Transporte ejecutivo",
    template: "%s | Rymvo",
  },
  description: "Transporte privado y ejecutivo para moverte con distinción.",
  applicationName: "Rymvo",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#d9a84e",
              colorBackground: "var(--color-rymvo-panel)",
              colorText: "var(--color-rymvo-paper)",
              colorTextSecondary: "var(--color-rymvo-muted)",
              colorInputBackground: "var(--color-rymvo-panel)",
              colorInputText: "var(--color-rymvo-paper)",
              colorTextOnPrimaryBackground: "#090909",
              borderRadius: "0.75rem",
            },
            elements: {
              card: "!border-[#d9a84e]/45 !bg-[var(--color-rymvo-panel)] shadow-2xl shadow-black/50",
              headerTitle: "text-2xl font-light tracking-[-.04em]",
              headerSubtitle: "text-white/50",
              socialButtonsBlockButton: "!border-[#d9a84e]/70 !bg-[var(--color-rymvo-auth-button)] !text-[var(--color-rymvo-paper)] shadow-[0_3px_12px_rgba(0,0,0,.22)] hover:!border-[#edc477] hover:!bg-[#d9a84e] hover:!text-black",
              socialButtonsBlockButtonText: "!font-semibold !text-[var(--color-rymvo-paper)]",
              formFieldLabel: "!text-[var(--color-rymvo-paper)]",
              formFieldInput: "!border-[#d9a84e]/45 !bg-[var(--color-rymvo-panel)] !text-[var(--color-rymvo-paper)] focus:!border-[#edc477] focus:!ring-[#d9a84e]/30",
              formButtonPrimary: "!border !border-[#edc477] !bg-[#d9a84e] !font-bold !text-black shadow-[0_5px_18px_rgba(217,168,78,.25)] hover:!bg-[#edc477] hover:!text-black",
              footerActionLink: "text-[#d9a84e] hover:text-[#edc477]",
            },
            layout: {
              logoImageUrl: "/rymvo_without_background.png",
              socialButtonsPlacement: "top",
              socialButtonsVariant: "blockButton",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
