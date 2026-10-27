import styles from "./BrandMark.module.css";

// The mark: a Detroit house with a heartbeat running through it. Animated, two
// defib paddles hit the walls, then the pulse draws across and the house lights.
// Keep in sync with src/app/icon.svg and public/brand/*.svg.
export const MARK_PATHS = {
  house: "M12 31L32 13l20 18v22H12z",
  pulse: "M3 41h14l4-7 4 13 6-24 6 21 3-7 3 4h18",
};

type Props = { size?: number; title?: string; animated?: boolean };

export default function BrandMark({ size = 28, title, animated = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={animated ? styles.animated : undefined}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path className={styles.house} d={MARK_PATHS.house} stroke="#f1ece2" strokeWidth="3" strokeLinejoin="round" />
      <path
        className={styles.pulse}
        d={MARK_PATHS.pulse}
        pathLength={1}
        stroke="#ffd166"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {animated && (
        <>
          <rect className={`${styles.paddle} ${styles.left}`} x="5" y="33" width="5" height="14" rx="2" fill="#f1ece2" />
          <rect className={`${styles.paddle} ${styles.right}`} x="54" y="33" width="5" height="14" rx="2" fill="#f1ece2" />
          <circle className={styles.flash} cx="32" cy="40" r="22" fill="#bfe3ff" />
        </>
      )}
    </svg>
  );
}
