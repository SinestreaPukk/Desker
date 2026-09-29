import * as React from "react";

/**
 * Text split into words for the landing page's word-by-word reveals. The
 * words stay one text node apart by a real space, so the line still wraps,
 * balances, reads and copies as the sentence it is.
 */

/**
 * The hero headline: words rise in on load, one after another (.hero-word).
 * Words from `highlight[0]` up to (not including) `highlight[1]` get the
 * highlighter swipe (.hl).
 */
export function HeroWords({ text, highlight }: { text: string; highlight?: [number, number] }) {
  const words = text.split(" ");
  const word = (w: string, index: number) => (
    <span key={index}>{w}</span>
  );
  if (!highlight) {
    return words.map((w, index) => (
      <React.Fragment key={index}>
        {word(w, index)}{" "}
      </React.Fragment>
    ));
  }
  const [from, to] = highlight;
  // The highlighted run is one element, so the swipe is one stroke: it runs
  // under the words and the spaces between them, drawn left to right, and
  // continues onto the next line if the run wraps.
  return (
    <>
      {words.slice(0, from).map((w, index) => (
        <React.Fragment key={index}>
          {word(w, index)}{" "}
        </React.Fragment>
      ))}
      <span className="hl">
        {words.slice(from, to).map((w, offset) => (
          <React.Fragment key={from + offset}>
            {offset ? " " : null}
            {word(w, from + offset)}
          </React.Fragment>
        ))}
      </span>{" "}
      {words.slice(to).map((w, offset) => (
        <React.Fragment key={to + offset}>
          {word(w, to + offset)}{" "}
        </React.Fragment>
      ))}
    </>
  );
}

/** A heading's text. Once split into words for a reveal; plain now - the
 * per-word scroll animations made scrolling janky. */
export function Words({ text }: { text: string }) {
  return <>{text}</>;
}
