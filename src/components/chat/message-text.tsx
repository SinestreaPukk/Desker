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
 * Paragraphs, list-ish lines, inline `code` spans and **bold** runs are
 * recognised because models produce them constantly and a wall of text reads
 * badly. Bold is the one models reach for most, and without it a transcript
 * shows a client the literal asterisks - so it is recognised the same way the
 * code spans are: split the string, wrap the piece in an element, and keep the
 * text a text child. Nothing here ever becomes markup from the string itself.
 */
export const MessageText = React.memo(function MessageText({ content }: { content: string }) {
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
});

/**
 * Splits on inline code spans and bold runs. Everything stays a React text
 * child: the delimiters choose which element wraps the piece, they never
 * become markup themselves. Code is first in the alternation so a bold run
 * inside backticks stays code.
 */
const Inline = React.memo(function Inline({ text }: { text: string }) {
  if (!text.includes("`") && !text.includes("**")) {
    return <>{text}</>;
  }

  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={index}
              className="rounded-sm bg-surface-3 px-1 py-0.5 font-mono text-[0.85em]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
});
