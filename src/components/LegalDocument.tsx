import { Link } from "@tanstack/react-router";
import {
  LEGAL_APP,
  LEGAL_EFFECTIVE,
  LEGAL_ORG,
  LEGAL_UPDATED,
  type LegalBlock,
  type LegalDoc,
} from "@/lib/legal";

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p className="mt-3">{block}</p>;
  if (Array.isArray(block))
    return (
      <ul className="mt-3 list-disc space-y-1.5 pl-6">
        {block.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  return <h3 className="mt-6 text-base font-semibold text-foreground">{block.h}</h3>;
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-lg">
            {LEGAL_APP}
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="eyebrow">{LEGAL_APP}</p>
        <h1 className="mt-2 text-3xl">{doc.title}</h1>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <dt className="font-medium text-foreground">Effective date</dt>
          <dd>{LEGAL_EFFECTIVE}</dd>
          <dt className="font-medium text-foreground">Last updated</dt>
          <dd>{LEGAL_UPDATED}</dd>
          <dt className="font-medium text-foreground">Operating organization</dt>
          <dd>{LEGAL_ORG}</dd>
        </dl>
        <div className="mt-8 text-sm leading-relaxed text-muted-foreground">
          {doc.sections.map((s, i) => (
            <section key={s.title} className="mt-10 first:mt-0">
              <h2 className="text-xl text-foreground">
                {i + 1}. {s.title}
              </h2>
              {s.body.map((b, j) => (
                <Block key={j} block={b} />
              ))}
            </section>
          ))}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t py-8 text-center text-xs text-muted-foreground">
      <p>Open-source board management · Accounting stays in OpenLedgerApp</p>
      <p className="mt-2 flex justify-center gap-4">
        <Link to="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link to="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </footer>
  );
}
