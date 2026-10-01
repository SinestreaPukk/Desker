"use client";

import * as React from "react";
import { STARTED_FIELD, TRAP_FIELD } from "@/lib/bot-check";

/**
 * The public forms' bot checks, client side (lib/bot-check.ts): a field
 * placed off-screen - not display:none, which some bots skip - that a person
 * never reaches, and the moment the form appeared.
 */
export function useBotTrap() {
  const started = React.useRef(0);
  React.useEffect(() => {
    started.current = Date.now();
  }, []);
  const field = (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name={TRAP_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
  return {
    field,
    values: (form: FormData) => ({ [TRAP_FIELD]: String(form.get(TRAP_FIELD) ?? ""), [STARTED_FIELD]: started.current }),
  };
}
