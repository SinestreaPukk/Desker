import * as React from "react";

/**
 * Renders model and client text.
 *
 * Deliberately not a markdown renderer: this content is attacker-influenced on
 * both sides (a client types it, or a model repeats what a client typed) and it
 * is displayed in the admin dashboard as well as the widget. React escapes text
 * children, so keeping everything as text children is what makes stored XSS
 * structurally impossible here rather than a sanitiser we have to trust.
 *
 * Paragraphs, list-ish lines and inline `code` spans are recognised because
 * models produce them constantly and a wall of text reads badly.
 */
export function MessageText({ content }: { content: string }) {
  const blocks = React.useMemo(
    () => content.split(/\n{2,}/).filter((block) => block.trim()),
    [content],
  );

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*([-*•]|\d+[.)])\s+/.test(line));

        if (isList) {
          const ordered = /^\s*\d+[.)]\s+/.test(lines[0]!);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag
              key={blockIndex}
              className={
                ordered
                  ? "list-decimal space-y-1 pl-5 marker:text-ink-subtle"
                  : "list-disc space-y-1 pl-5 marker:text-ink-subtle"
              }
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <Inline text={line.replace(/^\s*([-*•]|\d+[.)])\s+/, "")} />
                </li>
              ))}
            </Tag>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            <Inline text={block} />
          </p>
        );
      })}
    </>
  );
}

/** Splits on inline code spans. Everything stays a React text child. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code
            key={index}
            className="rounded-sm bg-surface-3 px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
