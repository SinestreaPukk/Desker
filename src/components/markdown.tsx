import * as React from "react";
import Link from "next/link";
import { headingId } from "@/lib/guides";
import { cn } from "@/lib/utils";

/**
 * The small subset of markdown the guides - and agents' reports - are written in.
 *
 * Deliberately not a markdown library: the input is our own content, the
 * subset is fixed (headings, paragraphs, lists, quotes, links, bold, code),
 * and a renderer we own means every element lands on the design system's
 * tokens rather than on a stylesheet bolted over someone else's classes.
 * Anything outside the subset renders as plain text rather than as raw
 * markup - there is no HTML passthrough here, by design.
 */

type Inline = React.ReactNode;

/** `**bold**`, `*italic*`, `` `code` ``, `[text](href)`. Everything else is literal. */
function renderInline(text: string, keyPrefix: string): Inline[] {
  const nodes: Inline[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-sm border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-ink"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(token) ?? [];
      // Agent reports come through here too, and they can repeat what a web
      // page said: only site-relative paths and http(s) become links.
      const external = href ? /^https?:\/\//i.test(href) : false;
      const internal = href ? href.startsWith("/") && !href.startsWith("//") : false;
      if (label && href && (external || internal)) {
        nodes.push(
          external ? (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              {label}
            </a>
          ) : (
            <Link key={key} href={href} className="text-accent hover:underline">
              {label}
            </Link>
          ),
        );
      } else {
        nodes.push(label ?? token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface Block {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "hr";
  lines: string[];
}

function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const push = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      push();
      blocks.push({ type: "hr", lines: [] });
      continue;
    }
    // Guides use ## and ###; agents also write # and ####, folded onto the same two.
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      push();
      blocks.push({ type: heading[1]!.length <= 2 ? "h2" : "h3", lines: [heading[2]!] });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (current?.type !== "ul") {
        push();
        current = { type: "ul", lines: [] };
      }
      current.lines.push(bullet[1]!);
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      if (current?.type !== "ol") {
        push();
        current = { type: "ol", lines: [] };
      }
      current.lines.push(numbered[1]!);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      if (current?.type !== "quote") {
        push();
        current = { type: "quote", lines: [] };
      }
      current.lines.push(quote[1]!);
      continue;
    }
    if (current?.type !== "p") {
      push();
      current = { type: "p", lines: [] };
    }
    current.lines.push(line);
  }
  push();
  return blocks;
}

export function Markdown({
  text,
  className,
  size = "panel",
}: {
  text: string;
  className?: string;
  /** "page" is the public guide: bigger type, headings that carry a page. */
  size?: "panel" | "page";
}) {
  const blocks = toBlocks(text);
  const page = size === "page";
  return (
    <div
      className={cn(
        "leading-relaxed text-ink-muted",
        page ? "space-y-4 text-base" : "space-y-3 text-sm",
        className,
      )}
    >
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "h2":
            return (
              <h2
                key={key}
                id={headingId(block.lines[0]!)}
                className={cn(
                  "scroll-mt-24 font-semibold tracking-tight text-ink",
                  page ? "pt-5 text-xl" : "pt-2 text-base",
                )}
              >
                {renderInline(block.lines[0]!, key)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={key}
                id={headingId(block.lines[0]!)}
                className={cn(
                  "scroll-mt-24 font-semibold text-ink",
                  page ? "pt-3 text-base" : "pt-1 text-sm",
                )}
              >
                {renderInline(block.lines[0]!, key)}
              </h3>
            );
          case "hr":
            return <hr key={key} className="border-line" />;
          case "ul":
            return (
              <ul key={key} className="ml-4 list-disc space-y-1.5 marker:text-ink-subtle">
                {block.lines.map((line, i) => (
                  <li key={i}>{renderInline(line, `${key}-${i}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="ml-4 list-decimal space-y-1.5 marker:text-ink-subtle">
                {block.lines.map((line, i) => (
                  <li key={i}>{renderInline(line, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-accent-line bg-accent-soft/20 py-2 pl-3 pr-2 text-ink"
              >
                {block.lines.map((line, i) => (
                  <p key={i}>{renderInline(line, `${key}-${i}`)}</p>
                ))}
              </blockquote>
            );
          default:
            return <p key={key}>{renderInline(block.lines.join(" "), key)}</p>;
        }
      })}
    </div>
  );
}
