/**
 * Underlines one phrase of a line - the page's small "this is the point"
 * mark. Decorative: the words are legible without it. A phrase that is not
 * in the text renders the text unmarked rather than failing.
 */
export function Highlight({ text, phrase }: { text: string; phrase?: string }) {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (!phrase || at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="highlight-underline">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}
