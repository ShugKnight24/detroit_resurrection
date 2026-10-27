"use client";

import { useState } from "react";
import type { Diagnosis } from "@/lib/diagnosis";
import { track } from "@/lib/events";
import type { Property } from "@/lib/properties";
import { DLBA_URL } from "@/lib/programs";
import styles from "./PatientChart.module.css";

type Props = {
  property: Property;
  diagnosis: Diagnosis;
  choice: number;
  onBack: () => void;
  onSubmitted: () => void;
};

const STEPS = ["Eligibility", "Your plan", "Documents", "Apply"] as const;

function eligibilityQuestion(p: Property): { ask: string; ifNo: string } {
  switch (p.category) {
    case "side":
      return {
        ask: "Do you own and live in the house directly next to this lot?",
        ifNo: "Side lots go to the next-door owner-occupant. Try a Neighborhood Lot nearby, or tell your neighbor about this one.",
      };
    case "lot":
      return {
        ask: `Do you live or own property in ${p.neighborhood}?`,
        ifNo: "Some lot programs favor neighbors. Check the program page. Oversized and marketed lots may be open to anyone.",
      };
    case "structure":
      return {
        ask: "Can you take on a renovation within the program's required timeline?",
        ifNo: "Look at side and neighborhood lots instead. They need far less money and time to bring back.",
      };
    default:
      return {
        ask: "This parcel isn't listed for sale yet. Do you want to ask the Land Bank about it?",
        ifNo: "Filter the map to lots for sale to find a patient you can adopt today.",
      };
  }
}

export default function ApplicationWizard({ property, diagnosis, choice, onBack, onSubmitted }: Props) {
  const option = diagnosis.options[choice] ?? diagnosis.options[0];
  const question = eligibilityQuestion(property);
  const [step, setStep] = useState(0);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [plan, setPlan] = useState(
    `I'd like to ${option.title.toLowerCase()} at ${property.address} (parcel ${property.parcelId}). ${option.why}`,
  );
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fields = { parcelId: property.parcelId, neighborhood: property.neighborhood };
  const go = (next: number) => {
    setStep(next);
    track("application_step", { ...fields, detail: STEPS[next] });
  };

  if (submitted) {
    return (
      <div className={styles.revived}>
        <p className={styles.kicker} style={{ color: "var(--alive)" }}>
          Pulse detected
        </p>
        <h3 className={styles.verdict}>{property.address} is coming back to life.</h3>
        <p>
          It&apos;s glowing gold on your map now. The Land Bank reviews applications and will contact you. Keep your
          plan handy for that conversation.
        </p>
        <button type="button" className={styles.secondary} onClick={onBack}>
          Back to the chart
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <ol className={styles.progress} aria-label="Application steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step}>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className={styles.step}>
          <h3>{question.ask}</h3>
          <div className={styles.choices}>
            <button type="button" aria-pressed={eligible === true} onClick={() => setEligible(true)}>
              Yes
            </button>
            <button type="button" aria-pressed={eligible === false} onClick={() => setEligible(false)}>
              No
            </button>
          </div>
          {eligible === false && <p className={styles.note}>{question.ifNo}</p>}
          <p className={styles.source}>
            Eligibility rules change. Confirm on <a href={DLBA_URL} target="_blank" rel="noreferrer">buildingdetroit.org</a>.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className={styles.step}>
          <h3>{option.title}</h3>
          <p className={styles.meta}>
            {option.program} · {option.cost} · {option.timeline}
          </p>
          <label className={styles.field}>
            <span>Your plan for the land, in your words. Applications usually ask for one.</span>
            <textarea rows={6} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </label>
          <button
            type="button"
            className={styles.secondary}
            onClick={async () => {
              await navigator.clipboard.writeText(plan);
              setCopied(true);
            }}
          >
            {copied ? "Copied ✓" : "Copy plan"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className={styles.step}>
          <h3>Gather what you need</h3>
          <ul className={styles.checklist}>
            {diagnosis.checklist.map((item, i) => (
              <li key={item.step}>
                <label>
                  <input
                    type="checkbox"
                    checked={done.has(i)}
                    onChange={() =>
                      setDone((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                  <span>
                    <strong>{item.step}</strong>
                    {item.detail}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 3 && (
        <div className={styles.step}>
          <h3>Submit to the Land Bank</h3>
          <p>
            Open the Land Bank&apos;s site, find parcel <strong>{property.parcelId}</strong>, and paste your plan into
            the application. Come back and tell us when it&apos;s in.
          </p>
          <a className={styles.primary} href={DLBA_URL} target="_blank" rel="noreferrer">
            Open buildingdetroit.org ↗
          </a>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setSubmitted(true);
              track("application_submitted", { ...fields, detail: option.kind });
              onSubmitted();
            }}
          >
            I submitted my application
          </button>
        </div>
      )}

      <div className={styles.nav}>
        <button type="button" className={styles.link} onClick={() => (step === 0 ? onBack() : go(step - 1))}>
          ← {step === 0 ? "Back to diagnosis" : "Back"}
        </button>
        {step < STEPS.length - 1 && (
          <button type="button" className={styles.primary} onClick={() => go(step + 1)} disabled={step === 0 && eligible === null}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
