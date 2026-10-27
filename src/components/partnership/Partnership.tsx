import CapacitySim from "./CapacitySim";
import styles from "./Partnership.module.css";

const QUESTIONS = [
  "Which fields cause the most back-and-forth with applicants?",
  "What makes an application incomplete most often?",
  "Which eligibility checks are manual today: taxes, blight tickets, adjacency?",
  "How many applications can staff review per week, per program?",
  "What status questions fill the phone lines and inbox?",
];

const PACKET = [
  { field: "Applicant and contact", state: "Verified" },
  { field: "Parcel ID and program", state: "Matched" },
  { field: "Eligibility answers", state: "Pre-checked" },
  { field: "Plan for the land", state: "Written" },
  { field: "Documents", state: "4 of 4" },
  { field: "Duplicate check", state: "Clear" },
];

const GUARDRAILS = [
  { title: "Eligibility pre-check", body: "Residents who don't qualify find out up front and get pointed to a program that fits." },
  { title: "Complete-packet gate", body: "Nothing goes to the Land Bank until every required field and document is in." },
  { title: "Intake paced to capacity", body: "The office sets a weekly number. Everyone else holds a place in line inside the app." },
  { title: "One parcel, one queue", body: "Multiple people asking about the same lot are grouped, not sent as separate cases." },
  { title: "Status without a phone call", body: "Applicants see where they stand, so staff time goes to decisions, not updates." },
  { title: "Staff triage view", body: "Packets sorted by program and neighborhood, ready for batch review." },
];

const PHASES = [
  { when: "Weeks 1–4", name: "Discover", body: "Shadow intake, map where applications stall, and agree on the packet fields together." },
  { when: "Months 2–4", name: "Pilot", body: "Side lots only, in two neighborhoods, with intake capped at the office's weekly number." },
  { when: "Month 5+", name: "Scale", body: "Add programs, then export packets straight into the Land Bank's own systems." },
];

const METRICS = ["Complete on first submission", "Staff minutes per application", "Days to decision", "Status calls and emails"];

export default function Partnership() {
  return (
    <section id="partnership" className={styles.section} aria-labelledby="partnership-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <span>02</span> Partnership
        </p>
        <h2 id="partnership-title" className={styles.title}>
          Built with the Land Bank, <em>not around it.</em>
        </h2>
        <p className={styles.lede}>
          More applicants only helps if the office can handle them. We want to partner with the Detroit Land Bank
          Authority, learn exactly what they need from residents, and send them complete, eligible, ready-to-review
          packets at a pace their staff can absorb.
        </p>
      </header>

      <div className={styles.three}>
        <article className={styles.card}>
          <p className={styles.label}>What we&apos;d ask first</p>
          <ol className={styles.questions}>
            {QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </article>

        <article className={`${styles.card} ${styles.packet}`}>
          <p className={styles.label}>What the office receives</p>
          <div className={styles.packetHead}>
            <span>Ready-to-review packet</span>
            <b>100% complete</b>
          </div>
          <ul className={styles.fields}>
            {PACKET.map((p) => (
              <li key={p.field}>
                <span>{p.field}</span>
                <b>✓ {p.state}</b>
              </li>
            ))}
          </ul>
          <p className={styles.small}>Fields finalized with Land Bank staff during discovery.</p>
        </article>

        <article className={styles.card}>
          <p className={styles.label}>The risk we design for</p>
          <h3 className={styles.risk}>Ten times the applications could bury a small team.</h3>
          <p className={styles.small}>
            So the app absorbs the volume instead of the office. Residents wait in a visible line and arrive
            pre-checked and complete.
          </p>
        </article>
      </div>

      <ul className={styles.guardrails}>
        {GUARDRAILS.map((g, i) => (
          <li key={g.title}>
            <span className={styles.gNo}>{String(i + 1).padStart(2, "0")}</span>
            <b>{g.title}</b>
            <span>{g.body}</span>
          </li>
        ))}
      </ul>

      <CapacitySim />

      <div className={styles.roadmap}>
        <ol className={styles.phases}>
          {PHASES.map((p) => (
            <li key={p.name}>
              <span className={styles.when}>{p.when}</span>
              <b>{p.name}</b>
              <span>{p.body}</span>
            </li>
          ))}
        </ol>
        <div className={styles.metrics}>
          <p className={styles.label}>Success, measured by the Land Bank</p>
          <ul>
            {METRICS.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
