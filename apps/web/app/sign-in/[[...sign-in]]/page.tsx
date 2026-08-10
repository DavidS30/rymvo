import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090909] px-4 py-10">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#d9a84e",
            colorBackground: "#1b1a17",
            colorText: "#f5f1e9",
            colorTextSecondary: "rgba(245, 241, 233, .58)",
            colorInputBackground: "#292721",
            colorInputText: "#f5f1e9",
            borderRadius: "0.75rem",
          },
          elements: {
            rootBox: "w-full max-w-[420px]",
            card: "border border-[#d9a84e]/35 bg-[#1b1a17] shadow-2xl shadow-black/50",
            headerTitle: "text-2xl font-light tracking-[-.04em]",
            headerSubtitle: "text-white/50",
            socialButtonsBlockButton: "border-white/25 bg-[#292721] text-white hover:border-[#edc477] hover:bg-[#37342b]",
            formFieldLabel: "text-white/85",
            formFieldInput: "border-white/25 bg-[#292721] text-white focus:border-[#edc477] focus:ring-[#d9a84e]/30",
            formButtonPrimary: "border border-[#edc477] bg-[#d9a84e] font-bold text-black shadow-[0_5px_18px_rgba(217,168,78,.25)] hover:bg-[#edc477]",
            footerActionLink: "text-[#d9a84e] hover:text-[#edc477]",
            identityPreviewEditButton: "text-[#d9a84e]",
          },
          layout: { logoImageUrl: "/rymvo_without_background.png", socialButtonsPlacement: "top", socialButtonsVariant: "blockButton" },
        }}
      />
    </div>
  );
}
