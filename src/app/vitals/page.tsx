import type { Metadata } from "next";
import Link from "next/link";
import LiveVitals from "@/components/vitals/LiveVitals";
import { inventoryStats } from "@/lib/snapshot-stats";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Vitals · Detroit Resurrection",
  description: "How many Detroit lots and houses people are working to bring back.",
};

export default async function VitalsPage() {
  const stats = await inventoryStats();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Detroit Resurrection
        </Link>
        <p className={styles.kicker}>Vitals</p>
        <h1 className={styles.title}>Is the city getting its pulse back?</h1>
        <p className={styles.lede}>
          We count every step from first look to submitted application, so you can see whether the map turns curiosity
          into revived land. {stats.total.toLocaleString()} Land Bank parcels are on the ward;{" "}
          {(stats.byCategory.side + stats.byCategory.lot + stats.byCategory.structure).toLocaleString()} are for sale
          today.
        </p>
      </header>
      <LiveVitals />
    </main>
  );
}
