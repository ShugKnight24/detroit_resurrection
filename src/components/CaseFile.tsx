import Link from "next/link";
import { CATEGORY_META, type Category } from "@/lib/properties";
import type { InventoryStats } from "@/lib/snapshot-stats";
import styles from "./CaseFile.module.css";

const ORDER: Category[] = ["side", "lot", "structure", "dormant"];
const PER_SQUARE = 250;

function waffle(stats: InventoryStats) {
  const squares: Category[] = [];
  for (const c of ORDER) {
    const n = Math.max(1, Math.round(stats.byCategory[c] / PER_SQUARE));
    for (let i = 0; i < n; i++) squares.push(c);
  }
  return squares;
}

const STEPS = [
  {
    title: "Find",
    line: "Every Land Bank lot and house on one map, searchable by address.",
    icon: <path d="M11 4a7 7 0 1 0 4.4 12.4L20 21M11 4a7 7 0 0 1 7 7" />,
  },
  {
    title: "Diagnose",
    line: "Claude reads the parcel, the block, your goal and photo, then drafts options with rough costs.",
    icon: <path d="M3 12h4l2-4 3 9 3-12 2 7h4" />,
  },
  {
    title: "Apply",
    line: "Eligibility, a written plan, a document checklist, then hand-off to the Land Bank.",
    icon: <path d="M5 12l4 4L19 6M4 20h16" />,
  },
];

const DOES = [
  "Matches each parcel to the right Land Bank program",
  "Drafts a plan in the resident's own words",
  "Builds the document checklist for that program",
];
const DOESNT = [
  "Invent prices, deadlines, or eligibility rules",
  "Recommend organizations that aren't on our vetted list",
  "Submit anything without the resident",
];

const PEOPLE = [
  { who: "Current residents", line: "A side yard, a block garden, or a fixed-up house, without decoding program rules alone." },
  { who: "Future residents", line: "Rehabbed houses become homes to move into, on blocks that look cared for." },
  { who: "The city", line: "Every parcel sold leaves the Land Bank's mowing list and heads back toward the tax rolls." },
];

const MEASURES = ["Applications started", "Applications submitted", "Minutes to apply", "Revived per neighborhood"];

export default function CaseFile({ stats }: { stats: InventoryStats }) {
  const forSale = stats.byCategory.side + stats.byCategory.lot + stats.byCategory.structure;
  const squares = waffle(stats);

  return (
    <section id="case" className={styles.case} aria-labelledby="case-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <span>01</span> The case file
        </p>
        <h2 id="case-title" className={styles.title}>
          A city full of patients. <em>The cure is mostly paperwork.</em>
        </h2>
      </header>

      <article className={styles.act}>
        <div className={styles.rail}>
          <p className={styles.label}>I · Chief complaint</p>
          <p className={styles.numeral}>{stats.total.toLocaleString()}</p>
          <p className={styles.unit}>Land Bank parcels across {stats.neighborhoods} neighborhoods</p>
        </div>
        <div className={styles.body}>
          <h3 className={styles.headline}>The land is waiting. The process is the wall.</h3>
          <p className={styles.text}>
            {forSale.toLocaleString()} parcels are for sale today and {stats.byCategory.dormant.toLocaleString()} aren&apos;t
            listed. Finding one, working out which program fits, and finishing the application takes time most neighbors
            don&apos;t have.
          </p>
          <div className={styles.waffle} role="img" aria-label={`${stats.total} Land Bank parcels by type`}>
            {squares.map((c, i) => (
              <span key={i} style={{ background: CATEGORY_META[c].color }} data-dim={c === "dormant"} />
            ))}
          </div>
          <ul className={styles.legend}>
            {ORDER.map((c) => (
              <li key={c} style={{ "--c": CATEGORY_META[c].color } as React.CSSProperties}>
                <b>{stats.byCategory[c].toLocaleString()}</b>
                <span>{CATEGORY_META[c].label}</span>
              </li>
            ))}
            <li className={styles.per}>1 square ≈ {PER_SQUARE} parcels</li>
          </ul>
        </div>
      </article>

      <article className={styles.act}>
        <div className={styles.rail}>
          <p className={styles.label}>II · Treatment</p>
          <p className={styles.numeral}>3</p>
          <p className={styles.unit}>steps from curious to applied</p>
        </div>
        <div className={styles.body}>
          <h3 className={styles.headline}>Find it. Diagnose it. Bring it back.</h3>
          <ol className={styles.flow}>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className={styles.icon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {s.icon}
                  </svg>
                </span>
                <span className={styles.stepNo}>0{i + 1}</span>
                <b>{s.title}</b>
                <span>{s.line}</span>
              </li>
            ))}
          </ol>
          <div className={styles.rules}>
            <div>
              <p className={styles.label}>The AI does</p>
              <ul className={styles.does}>
                {DOES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className={styles.label}>The AI never</p>
              <ul className={styles.doesnt}>
                {DOESNT.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>

      <article className={styles.act}>
        <div className={styles.rail}>
          <p className={styles.label}>III · Prognosis</p>
          <p className={styles.numeral}>3</p>
          <p className={styles.unit}>groups who gain when a lot comes back</p>
        </div>
        <div className={styles.body}>
          <h3 className={styles.headline}>Who it helps, and how we&apos;ll know.</h3>
          <ul className={styles.people}>
            {PEOPLE.map((p) => (
              <li key={p.who}>
                <b>{p.who}</b>
                <span>{p.line}</span>
              </li>
            ))}
          </ul>
          <div className={styles.measureRow}>
            <ul className={styles.measures}>
              {MEASURES.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <Link href="/vitals" className={styles.vitals}>
              Live vitals →
            </Link>
          </div>
        </div>
      </article>

      <p className={styles.source}>
        Source: City of Detroit Open Data, DLBA Owned Properties, pulled{" "}
        {new Date(stats.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
      </p>
    </section>
  );
}
