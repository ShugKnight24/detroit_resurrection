"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import styles from "./Theatre.module.css";
import { loadYouTube, type YTPlayer } from "./youtube";

// Dr. Dre, "I Need a Doctor" (feat. Eminem & Skylar Grey)
const VIDEO_ID = "VA770wpLX-Q";

export type TheatreHandle = { play: () => void };

export default function Theatre({ ref, revived }: { ref?: Ref<TheatreHandle>; revived: boolean }) {
  const section = useRef<HTMLElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const pending = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [docked, setDocked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadYouTube().then((YT) => {
      if (cancelled || !mount.current) return;
      // The API swaps its target for an iframe, so give it a node React doesn't own.
      const target = document.createElement("div");
      mount.current.appendChild(target);
      player.current = new YT.Player(target, {
        videoId: VIDEO_ID,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            ready.current = true;
            if (pending.current) start();
          },
          onStateChange: ({ data }) => {
            const isPlaying = data === YT.PlayerState.PLAYING;
            setPlaying(isPlaying);
            if (isPlaying) setStarted(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    // Dock only once the visitor has scrolled past the theatre, not above it.
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function start() {
    pending.current = false;
    player.current?.unMute();
    player.current?.setVolume(80);
    player.current?.playVideo();
    setStarted(true);
    setDocked(true);
  }

  useImperativeHandle(ref, () => ({
    play: () => {
      if (ready.current) start();
      else pending.current = true;
    },
  }));

  // Once the song is going, keep it on screen in a corner while people browse.
  const mini = started && offscreen && docked;

  return (
    <section id="theatre" ref={section} className={styles.theatre} data-open={started || revived}>
      <div className={styles.marquee}>
        <span className={styles.now}>Now showing</span>
        <span className={styles.feature}>I Need a Doctor</span>
        <span className={styles.billing}>Dr. Dre · Eminem · Skylar Grey</span>
      </div>

      <div className={styles.stage}>
        <div className={styles.screen}>
          <div className={`${styles.player} ${mini ? styles.mini : ""}`}>
            <div ref={mount} />
            {mini && (
              <button
                type="button"
                className={styles.close}
                aria-label="Close mini player"
                onClick={() => {
                  player.current?.pauseVideo();
                  setDocked(false);
                }}
              >
                ×
              </button>
            )}
          </div>
          {!started && (
            <button type="button" className={styles.playOverlay} onClick={start}>
              <span>▶</span> Roll the film
            </button>
          )}
        </div>
        <div className={`${styles.curtain} ${styles.left}`} aria-hidden />
        <div className={`${styles.curtain} ${styles.right}`} aria-hidden />
      </div>

      <p className={styles.caption}>
        Every vacant lot in Detroit is a patient waiting on a doctor. {playing ? "Keep the song on and" : "Scroll down to"}{" "}
        <a href="#map">find one to bring back</a>.
      </p>
    </section>
  );
}
