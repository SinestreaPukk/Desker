import * as React from "react";

/** The one frame every screen sits in: a title, one plain line, then the content. */
export function Screen({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-hand text-large-title text-ink">{title}</h1>
          {hint ? <p className="mt-2 text-ink-muted">{hint}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
