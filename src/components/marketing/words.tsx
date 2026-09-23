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

/**
 * A heading whose words rise in as it scrolls into view (.sd-words /
 * .sd-word). Each word takes a slightly later slice of the heading's own
 * entry, so they arrive left to right.
 */
export function Words({ text }: { text: string }) {
  return (
    <span className="sd-words">
      {text.split(" ").map((word, index) => (
        <span key={index}>
          <span
            className="sd-word"
            style={{ animationRange: `entry ${10 + index * 6}% cover ${32 + index * 6}%` } as React.CSSProperties}
          >
            {word}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}
