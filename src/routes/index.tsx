import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, FileSignature, Gavel, ListChecks, ShieldCheck, FolderLock } from "lucide-react";
import hero from "@/assets/hero-board.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "OpenBoard — Board management for small nonprofits" },
      { name: "description", content: "Open-source board management: agendas, minutes, motions, board packets and action items for volunteer-led organizations." },
      { property: "og:title", content: "OpenBoard — Board management for small nonprofits" },
      { property: "og:description", content: "Prepare, meet, record, approve and follow up — without becoming a governance expert." },
    ],
  }),
  component: Home,
});

const features = [
  { icon: CalendarCheck, title: "Prepare", text: "Build agendas, track attendance and quorum, and assemble the board packet." },
  { icon: Gavel, title: "Record decisions", text: "Capture motions, movers and vote counts against each agenda item." },
  { icon: FileSignature, title: "Approve minutes", text: "Generate formal minutes, submit for approval and lock the official version." },
  { icon: ListChecks, title: "Follow up", text: "Assign action items with due dates that stay visible after the meeting." },
  { icon: FolderLock, title: "Governance library", text: "Bylaws, policies and reports with versions and private download links." },
  { icon: ShieldCheck, title: "Traceable", text: "Every change is logged. Each organization's records stay separate." },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg text-hero-foreground">OpenBoard</span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/board">Open the board room</Link>
          </Button>
        </div>
      </header>
      <section className="relative overflow-hidden bg-hero">
        <img src={hero} alt="Volunteer board members meeting around a table" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-hero via-hero/85 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36 md:pt-44">
          <p className="font-mono text-xs uppercase tracking-widest text-hero-accent">A sister project to OpenLedgerApp</p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-tight text-hero-foreground md:text-5xl">
            Good governance, without becoming a governance expert.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-hero-muted">
            OpenBoard guides your volunteer secretary through preparing meetings, taking notes, approving minutes and following up —
            while keeping an accurate record of what the board decided.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-hero-accent text-hero-accent-foreground hover:bg-hero-accent/90">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">Prepare · Meet · Record · Approve · Follow up</p>
        <h2 className="mt-2 text-3xl">One complete meeting lifecycle</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Open-source board management · Accounting stays in OpenLedgerApp
      </footer>
    </div>
  );
}
