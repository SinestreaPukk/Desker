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
const SHOT = /^!\[([^\]]*)\]\((\/api\/browser\/shot\?key=[A-Za-z0-9%._-]+)\)$/;

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
        // Screenshots the browser assistant kept: our own route only, never an outside image.
        if (lines.every((line) => SHOT.test(line.trim()))) {
          return (
            <div key={blockIndex} className="flex flex-col gap-2">
              {lines.map((line, lineIndex) => {
                const [, caption, src] = SHOT.exec(line.trim())!;
                return (
                  <a key={lineIndex} href={src} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a private, authenticated screenshot */}
                    <img src={src} alt={caption} loading="lazy" className="w-full max-w-xl rounded-md border border-line" />
                    {caption ? <span className="mt-1 block text-xs text-ink-muted">{caption}</span> : null}
                  </a>
                );
              })}
            </div>
          );
        }
        // Sources sit at the bottom, apart from the reply, as small link buttons.
        if (/^\**Sources:?\**\s*\n/i.test(block)) {
          return (
            <div key={blockIndex} className="flex flex-wrap gap-1.5 border-t border-line pt-3">
              {lines.slice(1).map((line, lineIndex) => (
                <SourceChip key={lineIndex} line={line} fallback={lineIndex + 1} />
              ))}
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

/** "[1] Title - https://…" becomes a small "Source 1" button; the title shows on hover. Lines without a link are skipped. */
function SourceChip({ line, fallback }: { line: string; fallback: number }) {
  const match = /^\s*(?:[-*•]\s+)?(?:\[?(\d+)[\].)]?)?\s*(.*?)\s*[-–—:]?\s*(https?:\/\/\S+)\s*$/.exec(line);
  if (!match) return null;
  return (
    <a
      href={match[3]}
      target="_blank"
      rel="noopener noreferrer"
      title={match[2] || match[3]}
      className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-accent transition-colors hover:border-accent-line hover:bg-accent-soft/40"
    >
      Source {match[1] ?? fallback}
    </a>
  );
}
