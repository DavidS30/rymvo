"use client";

import Image from "next/image";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useDictionary } from "@/lib/useDictionary";

const serviceKeys = ["transferTitle", "airportTitle", "tailoredTitle"] as const;
const serviceDescKeys = ["transferDesc", "airportDesc", "tailoredDesc"] as const;
const serviceNumbers = ["01", "02", "03"];

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const dict = useDictionary();

  return (
    <main className="rymvo-landing min-h-screen overflow-hidden bg-rymvo-ink text-rymvo-paper">
      <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 px-6 py-6 lg:px-10">
        <a href="#inicio" aria-label="Rymvo home"><Image src="/rymvo_icon_wb.png" alt="Rymvo" width={142} height={142} className="h-12 w-auto object-contain" priority /></a>
        <div className="hidden items-center gap-10 text-xs uppercase tracking-[.2em] text-white/55 md:flex"><a href="#servicios" className="hover:text-[#d9a84e]">{dict.nav.services}</a><a href="#filosofia" className="hover:text-[#d9a84e]">{dict.nav.philosophy}</a><a href="#contacto" className="hover:text-[#d9a84e]">{dict.nav.contact}</a></div>
        <div className="flex items-center gap-2 sm:gap-3"><LanguageToggle /><ThemeToggle />{isLoaded && isSignedIn ? <><a href="/dashboard" className="border border-[#c99642] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#e5bb70] transition hover:bg-[#c99642] hover:text-black sm:px-4 sm:text-xs sm:tracking-[.15em]">{dict.nav.dashboard}</a><UserButton /></> : <><SignInButton mode="modal" fallbackRedirectUrl="/dashboard"><button className="px-2 py-3 text-[10px] font-semibold uppercase tracking-[.1em] text-white/70 hover:text-white sm:px-4 sm:text-xs sm:tracking-[.15em]">{dict.nav.signIn}</button></SignInButton><SignUpButton mode="modal" fallbackRedirectUrl="/dashboard"><button className="border border-[#c99642] px-3 py-3 text-[10px] font-semibold uppercase tracking-[.1em] text-[#e5bb70] transition hover:bg-[#c99642] hover:text-black sm:px-5 sm:text-xs sm:tracking-[.15em]">{dict.nav.createAccount}</button></SignUpButton></>}</div>
      </nav>

      <section id="inicio" className="relative mx-auto grid min-h-[690px] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.02fr_.98fr] lg:px-10 lg:py-24">
        <div className="pointer-events-none absolute -left-48 top-32 size-[30rem] rounded-full bg-[#c99642]/10 blur-[130px]" />
        <div className="relative z-10"><p className="mb-8 text-xs uppercase tracking-[.3em] text-[#d9a84e]">{dict.hero.tagline}</p><h1 className="max-w-3xl text-[clamp(4rem,8vw,8.6rem)] font-light leading-[.82] tracking-[-.08em]">{dict.hero.titlePart1}<br /><span className="font-medium text-[#d9a84e]">{dict.hero.titlePart2}</span></h1><p className="mt-9 max-w-md text-lg leading-8 text-white/55">{dict.hero.subtitle}</p><div className="mt-10 flex flex-wrap gap-4"><SignUpButton mode="modal" fallbackRedirectUrl="/dashboard"><button className="bg-[#d9a84e] px-7 py-4 text-xs font-bold uppercase tracking-[.16em] text-black transition hover:bg-[#edc477]">{dict.hero.cta} <span className="ml-4">↗</span></button></SignUpButton><a href="#filosofia" className="border border-white/20 px-7 py-4 text-xs font-bold uppercase tracking-[.16em] text-white/75 transition hover:border-[#d9a84e] hover:text-[#d9a84e]">{dict.hero.secondary}</a></div></div>
        <div className="relative mx-auto flex h-[500px] w-full max-w-[520px] items-center justify-center"><div className="absolute size-[25rem] rounded-full border border-[#c99642]/25" /><div className="absolute size-[20rem] rounded-full border border-white/10" /><Image src="/rymvo_without_background.png" alt="Rymvo logo" width={1024} height={1024} className="relative z-10 size-[22rem] object-contain drop-shadow-[0_0_65px_rgba(211,159,67,.2)]" /><span className="absolute bottom-2 right-3 text-[10px] uppercase tracking-[.3em] text-white/30">{dict.hero.watermark}</span></div>
      </section>

      <section id="servicios" className="border-y border-white/10 bg-rymvo-panel px-6 py-20 lg:px-10"><div className="mx-auto max-w-7xl"><div className="mb-14 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-4 text-xs uppercase tracking-[.3em] text-[#d9a84e]">{dict.services.heading}</p><h2 className="max-w-xl text-4xl font-light tracking-[-.05em] md:text-6xl">{dict.services.titlePart1}<br /><span className="text-white/45">{dict.services.titlePart2}</span></h2></div><p className="max-w-xs text-sm leading-6 text-white/45">{dict.services.subtitle}</p></div><div className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">{serviceKeys.map((key, i) => <article key={key} className="group bg-rymvo-panel p-8 transition hover:bg-[#191816] lg:p-10"><span className="text-xs tracking-[.2em] text-[#d9a84e]">{serviceNumbers[i]}</span><div className="mt-24 flex items-end justify-between gap-4"><h3 className="text-2xl font-light tracking-[-.03em]">{dict.services[key]}</h3><span className="text-xl text-[#d9a84e] transition group-hover:translate-x-1">↗</span></div><p className="mt-5 text-sm leading-6 text-white/45">{dict.services[serviceDescKeys[i]]}</p></article>)}</div></div></section>

      <section id="filosofia" className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-2 lg:px-10"><div><Image src="/rymvo_without_background.png" alt="Rymvo gold logo" width={1280} height={1280} className="w-56 opacity-90" /></div><div><p className="mb-6 text-xs uppercase tracking-[.3em] text-[#d9a84e]">{dict.philosophy.tagline}</p><h2 className="max-w-xl text-4xl font-light leading-tight tracking-[-.05em] md:text-5xl">{dict.philosophy.titlePart1}<br /><i className="font-serif text-[#d9a84e]">{dict.philosophy.titlePart2}</i></h2><p className="mt-7 max-w-md text-base leading-8 text-white/50">{dict.philosophy.body}</p></div></section>

      <footer id="contacto" className="border-t border-white/10 px-6 py-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-xs uppercase tracking-[.15em] text-white/35 md:flex-row"><span>{dict.footer.copyright}</span><span>{dict.footer.tagline}</span><a href="mailto:hola@rymvo.com" className="hover:text-[#d9a84e]">hello@rymvo.com</a></div></footer>
    </main>
  );
}
