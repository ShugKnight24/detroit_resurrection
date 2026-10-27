import Link from "next/link";
import BrandMark from "./BrandMark";
import styles from "./SiteNav.module.css";

export default function SiteNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="Detroit Resurrection home">
        <BrandMark size={28} animated />
        <span>
          Detroit <em>Resurrection</em>
        </span>
      </Link>
      <nav aria-label="Primary" className={styles.links}>
        <Link href="/#case">The case</Link>
        <Link href="/#theatre">Theatre</Link>
        <Link href="/vitals">Vitals</Link>
        <Link href="/#map" className={styles.cta}>
          Find a lot
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <BrandMark size={22} />
        <span>
          Detroit <em>Resurrection</em>
        </span>
      </div>
      <p>
        Built for Detroit. Parcel data from the City of Detroit Open Data portal. Not affiliated with the Detroit Land
        Bank Authority; confirm every program detail at{" "}
        <a href="https://buildingdetroit.org" target="_blank" rel="noreferrer">
          buildingdetroit.org
        </a>
        .
      </p>
    </footer>
  );
}
