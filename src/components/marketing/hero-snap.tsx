"use client";

import * as React from "react";

/**
 * Lands the landing hero's product window whole.
 *
 * Measures where the window should pin - centred in the screen below the
 * header - and so the scroll at which it pins, and hands both to the CSS
 * (--pin-top, --rise-end on the hero section; see "The hero's stage" in
 * globals.css). Then, when a scroll comes to rest between the top of the
 * page and that pin, finishes it in the direction the reader was going:
 * down to the pinned window, or back up to the top. Once the window is
 * pinned, and everywhere past it, scrolling is left alone.
 *
 * It only acts after a scroll has come to rest, so it never fights the
 * wheel, a finger or the keys. No snapping under reduced motion (there is
 * no rise to finish). Renders nothing.
 */

const HEADER_H = 56;
/** The window never pins closer to the header than this. */
const MIN_TOP = 72;

export function HeroSnap() {
  const marker = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const section = marker.current?.closest("section");
    const track = section?.querySelector<HTMLElement>(".stage-track");
    const stage = track?.querySelector<HTMLElement>(".stage-pin");
    if (!section || !track || !stage) return;

    let pinStart = 0;
    const measure = () => {
      const pinTop = Math.max(MIN_TOP, HEADER_H + (window.innerHeight - HEADER_H - stage.offsetHeight) / 2);
      // The track's top is where the window sits before it pins.
      pinStart = Math.max(0, track.getBoundingClientRect().top + window.scrollY - pinTop);
      // On the section, so the copy's fade reads the same end as the rise.
      section.style.setProperty("--pin-top", `${pinTop}px`);
      section.style.setProperty("--rise-end", `${pinStart}px`);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    window.addEventListener("resize", measure);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasScrollEnd = "onscrollend" in document.documentElement;
    let last = window.scrollY;
    let direction = 0;
    let settling = false;
    let timer = 0;

    const settle = () => {
      if (settling) {
        settling = false;
        return;
      }
      const y = window.scrollY;
      if (y <= 2 || y >= pinStart - 2) return;
      settling = true;
      window.scrollTo({ top: direction >= 0 ? pinStart : 0, behavior: "smooth" });
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== last) direction = y > last ? 1 : -1;
      last = y;
      // scrollend where the browser has it; a short quiet period elsewhere.
      if (!hasScrollEnd) {
        window.clearTimeout(timer);
        timer = window.setTimeout(settle, 140);
      }
    };
    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("scrollend", settle);
    }
    return () => {
      resize.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", settle);
    };
  }, []);

  return <span ref={marker} hidden />;
}
