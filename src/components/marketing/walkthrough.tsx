"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SampleRun } from "@/components/first-run/sample-run";
import { FIRST_RUNS } from "@/lib/first-run";
import type { SpaceKind } from "@/lib/space";

/**
 * The landing page's walkthrough: the same sample run a new user steps
 * through on their first day, for either audience. Labelled for what it is -
 * the product on example data - where a customer story would otherwise go.
 */
export function Walkthrough({ label, cta }: { label: string; cta: { label: string; href: string } }) {
  const [audience, setAudience] = React.useState<SpaceKind>("business");
  const run = FIRST_RUNS[audience];
  return (
    <Panel className="mx-auto max-w-5xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={audience} onValueChange={(next) => setAudience(next as SpaceKind)}>
          <TabsList aria-label="Which walkthrough">
            <TabsTrigger value="business">
              <Briefcase aria-hidden />
              For a business
            </TabsTrigger>
            <TabsTrigger value="personal">
              <House aria-hidden />
              For yourself
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{run.name}</h3>
      <div className="mt-4">
        <SampleRun
          key={audience}
          run={run}
          footer={
            <Button asChild>
              <Link href={cta.href}>
                {cta.label}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      </div>
    </Panel>
  );
}
