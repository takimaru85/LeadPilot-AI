import Link from "next/link";
import { ArrowRight, BadgeCheck, Ban, FileSearch, Gauge, MailCheck, ScrollText, ShieldCheck, Sparkles, Target, UserCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

const steps = [
  { icon: Target, title: "Describe what you sell", body: "Tell us about your product and who it helps. AI turns it into a clear ideal customer profile." },
  { icon: FileSearch, title: "Discover relevant businesses", body: "Search public business listings. Every lead records exactly where its data came from." },
  { icon: Sparkles, title: "Understand the fit", body: "AI qualifies each company against your profile, citing evidence — and saying what it doesn't know." },
  { icon: MailCheck, title: "Review personal drafts", body: "Three honest, short email variants per lead. No fake familiarity, no invented facts." },
  { icon: UserCheck, title: "You approve every send", body: "Nothing goes out until you click Approve & Send. Replies and meetings are tracked per campaign." },
];

const safeguards = [
  { icon: ShieldCheck, title: "Public business data only", body: "No personal or sensitive data, no scraping behind logins, robots.txt respected, CAPTCHAs never bypassed." },
  { icon: BadgeCheck, title: "Nothing invented", body: "Contact details are only ever what a business published. AI output is checked for unsupported claims." },
  { icon: Gauge, title: "Limits built in", body: "Daily caps, per-minute throttling and warm-up for new accounts. We optimise for relevance, not volume." },
  { icon: Ban, title: "Unsubscribe that works", body: "One-click unsubscribe on every email, a permanent suppression list and duplicate prevention." },
  { icon: ScrollText, title: "Full audit trail", body: "Every approval, send, edit and suppression is logged with who did it and when." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#how-it-works" className="hidden rounded-md px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 sm:block">How it works</a>
            <a href="#responsible" className="hidden rounded-md px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 sm:block">Responsible outreach</a>
            <ButtonLink href="/login" variant="secondary" size="sm">Sign in</ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-brand-100),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center sm:pt-32">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-[13px] font-medium text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> B2B prospecting, done thoughtfully
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-6xl">Find the people who need your product.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance text-zinc-600">
              Discover relevant prospects, understand why they may need you, and send personalized outreach — without spending hours researching leads.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/login" size="lg" className="w-full sm:w-auto">
                Find My First Leads <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
                See How It Works
              </ButtonLink>
            </div>
          </div>

          <div className="relative mx-auto max-w-5xl px-6 pb-24">
            <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-pop">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5">
                <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr]">
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Harbourside Family Dental</div>
                        <div className="text-xs text-zinc-500">Dental clinic · Sydney, NSW</div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">Strong fit · 82</span>
                    </div>
                    <div className="mt-4 space-y-2 text-[13px]">
                      <div className="font-medium text-zinc-700">Evidence</div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-600">Website shows “© 2016” <span className="text-zinc-400">— Company website</span></div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-600">Asks patients to phone to book <span className="text-zinc-400">— Company website</span></div>
                      <div className="pt-1 text-zinc-500"><span className="font-medium text-zinc-700">Unknown:</span> whether they already work with an agency.</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-[13px]">
                    <div className="text-xs text-zinc-500">To reception@harboursidedental… · Professional</div>
                    <div className="mt-1 font-medium">Online booking at Harbourside Family Dental</div>
                    <p className="mt-3 leading-relaxed text-zinc-600">
                      Hi Dr Raman, Harbourside Family Dental&apos;s website asks patients to phone to book. For some practices that can mean missed after-hours enquiries — I don&apos;t know whether that&apos;s true for you…
                    </p>
                    <div className="mt-4 flex gap-2">
                      <span className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">Approve &amp; Send</span>
                      <span className="rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-zinc-200">Edit</span>
                      <span className="rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-zinc-200">Skip</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-t border-zinc-100 bg-zinc-50/60 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-3 text-zinc-600">From “what do you sell?” to a reviewed, personal email in minutes — with you in control of every send.</p>
            </div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
                  <div className="flex items-center gap-2 text-brand-600">
                    <s.icon className="h-5 w-5" />
                    <span className="text-xs font-semibold text-zinc-400">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="responsible" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Responsible by design</h2>
              <p className="mt-3 text-zinc-600">Relevant outreach to businesses that may genuinely need you — never bulk spam. These safeguards are built in, not optional.</p>
            </div>
            <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {safeguards.map((s) => (
                <div key={s.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><s.icon className="h-[18px] w-[18px]" /></div>
                  <div>
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl bg-zinc-900 px-8 py-10 text-white sm:flex-row sm:items-center">
              <div>
                <h3 className="text-xl font-semibold">Ready to find your first leads?</h3>
                <p className="mt-1 text-sm text-zinc-400">Set up your product in two minutes. Try it with sample data before connecting anything.</p>
              </div>
              <Link href="/login" className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[15px] font-medium text-zinc-900 hover:bg-zinc-100">
                Find My First Leads <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-zinc-500 sm:flex-row">
          <Logo className="scale-90" />
          <p>Built for legitimate B2B outreach. Respect your recipients and the law where they are.</p>
        </div>
      </footer>
    </div>
  );
}
