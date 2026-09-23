/**
 * Text split into words for the landing page's word-by-word reveals. The
 * words stay one text node apart by a real space, so the line still wraps,
 * balances, reads and copies as the sentence it is.
 */

/** The hero headline: words rise in on load, one after another (.hero-word). */
export function HeroWords({ text }: { text: string }) {
  return text.split(" ").map((word, index) => (
    <span key={index}>
      <span className="hero-word" style={{ "--i": index } as React.CSSProperties}>
        {word}
      </span>{" "}
    </span>
  ));
}

/** A heading's text. Once split into words for a reveal; plain now - the
 * per-word scroll animations made scrolling janky. */
export function Words({ text }: { text: string }) {
  return <>{text}</>;
}
