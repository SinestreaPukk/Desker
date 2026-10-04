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
 * Paragraphs, headings, list-ish lines, http(s) links, a Sources block, inline `code` spans and **bold** runs are
 * recognised because models produce them constantly and a wall of text reads
 * badly. Bold is the one models reach for most, and without it a transcript
 * shows a client the literal asterisks - so it is recognised the same way the
 * code spans are: split the string, wrap the piece in an element, and keep the
 * text a text child. Nothing here ever becomes markup from the string itself.
 */
export const MessageText = React.memo(function MessageText({ content }: { content: string }) {
  const blocks = React.useMemo(
    // A heading line is its own block, so "## Title\ntext" renders as a title then text.
    () => content.replace(/^(#{1,4} .*)$/gm, "\n\n$1\n\n").split(/\n{2,}/).filter((block) => block.trim()),
    [content],
  );

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const heading = /^(#{1,4})\s+(.*)$/.exec(block.trim());
        if (heading) {
          const size = ["text-xl", "text-lg", "text-base", "text-base"][heading[1]!.length - 1];
          return (
            <h3 key={blockIndex} className={`${size} mt-2 font-semibold leading-snug text-ink`}>
              <Inline text={heading[2]!} />
            </h3>
          );
        }
        // Sources sit at the bottom, one per line, each a blue link.
        if (/^\**Sources:?\**\s*\n/i.test(block)) {
          return (
            <div key={blockIndex} className="space-y-1 border-t border-line pt-3 text-sm">
              <p className="font-semibold text-ink">Sources</p>
              <ul className="space-y-1">
                {lines.slice(1).filter((line) => line.trim()).map((line, lineIndex) => (
                  <li key={lineIndex}>
                    <Source line={line} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
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
  if (!text.includes("`") && !text.includes("**") && !text.includes("http")) {
    return <>{text}</>;
  }

  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g);
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
        const markdown = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
        if (markdown) return <ExternalLink key={index} href={markdown[2]!}>{markdown[1]}</ExternalLink>;
        if (/^https?:\/\//.test(part)) return <ExternalLink key={index} href={part}>{part}</ExternalLink>;
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
});

/** Only http(s) ever becomes a link, and the address is the element's href, never markup. */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-accent underline underline-offset-2 hover:text-accent-hover">
      {children}
    </a>
  );
}

/** "[1] Title - https://…" becomes "[1] Title" with the title as the link; anything else falls back to inline. */
function Source({ line }: { line: string }) {
  const match = /^\s*(?:[-*•]\s+)?(\[?\d+[\].)]?)\s*(.*?)\s+[-–—]\s+(https?:\/\/\S+)\s*$/.exec(line);
  if (!match) return <Inline text={line.replace(/^\s*[-*•]\s+/, "")} />;
  return (
    <>
      <span className="text-ink-muted">{match[1]} </span>
      <ExternalLink href={match[3]!}>{match[2] || match[3]}</ExternalLink>
    </>
  );
}
