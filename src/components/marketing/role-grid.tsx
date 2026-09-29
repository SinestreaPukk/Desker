"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building, Sparkles, UserRound } from "lucide-react";
import { TEMPLATES } from "@/lib/content";
import { StickyNote } from "@/components/marketing/desk-notes";
import { AgentAvatar } from "@/components/ui/avatar";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { cn } from "@/lib/utils";

/** Who fills each role at ABC Inc., as the demo cast them. */
export const ROLE_STAFF: Record<string, readonly [string, string]> = {
  "customer-support": ["Mia", "mia"],
  "client-onboarding": ["Ivy", "ivy"],
  researcher: ["Sol", "sol"],
  marketer: ["Nova", "nova"],
  secretary: ["Kai", "kai"],
  "dev-support": ["Ada", "ada"],
  "sales-development": ["Leo", "leo-leads"],
  "people-ops": ["Rae", "rae"],
  "money-manager": ["Penny", "penny"],
  "personal-assistant": ["Juno", "juno"],
  "social-media-manager": ["Remy", "remy"],
  "career-coach": ["Theo", "theo"],
  "travel-planner": ["Isla", "isla"],
  "learning-coach": ["Ollie", "ollie"],
};

export const ROLE_TONES = ["lemon", "sky", "mint", "coral", "lilac", "mint", "lemon", "sky"] as const;
export const ROLE_TILTS = [-1.2, 0.9, -0.5, 1.3, -1, 0.6, 1.1, -0.7];

export type RoleAudience = "business" | "personal" | "all";

interface RoleGridProps {
  cta: string;
  groups: {
    business: string;
    personal: string;
  };
}

const PERSONAL_ROLE_IDS = new Set([
  "money-manager",
  "personal-assistant",
  "social-media-manager",
  "career-coach",
  "travel-planner",
  "learning-coach",
]);

interface RoleCardProps {
  role: (typeof TEMPLATES)[number];
  index: number;
  cta: string;
}

function RoleCard({ role, index, cta }: RoleCardProps) {
  const [name, seed] = ROLE_STAFF[role.id] ?? [role.name, role.id];
  const isPersonal = role.audience === "personal";
  const tone = ROLE_TONES[(index + (isPersonal ? 2 : 0)) % ROLE_TONES.length]!;
  const tilt = ROLE_TILTS[index % ROLE_TILTS.length]!;

  return (
    <li className="sd-rise">
      <Link
        href={`/showcase#${role.id}`}
        className="group block h-full rounded-sm focus-visible:outline-offset-4"
      >
        <StickyNote
          tone={tone}
          tilt={tilt}
          settle={false}
          soft
          className="relative flex h-full flex-col px-5 pb-5 pt-6 transition-transform duration-200"
        >
          {/* Header: Avatar, Handwritten Name, Template Title, and Stamp Icon */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <AgentAvatar name={name} seed={seed} size="lg" />
              <div>
                <span className="block font-hand text-hand-cta font-bold leading-none text-ink">
                  {name}
                </span>
                <span className="mt-1 block text-sm font-semibold text-ink">
                  {role.name}
                </span>
              </div>
            </div>
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink-muted transition-transform duration-200 group-hover:scale-110"
              aria-hidden
            >
              <TemplateIcon icon={role.icon} className="size-3.5" />
            </span>
          </div>

          {/* Job Title and Team designation */}
          <p className="mt-2 text-xs font-medium text-ink-muted">
            {role.team ? `${role.jobTitle} · ${role.team}` : role.jobTitle}
          </p>

          {/* Pitch */}
          <p className="mt-3 text-sm leading-relaxed text-ink/85">
            {role.pitch}
          </p>

          {/* Action Link */}
          <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-accent transition-colors group-hover:text-accent-hover">
            {cta}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </span>
        </StickyNote>
      </Link>
    </li>
  );
}

/**
 * The roles as a roster pinned to the desk: a note per role, in the person
 * who does it at ABC Inc. - their face, their name, the job.
 * Allows choosing between business, personal, or all roles with a segmented control.
 */
export function RoleGrid({ cta, groups }: RoleGridProps) {
  const [currentTab, setCurrentTab] = React.useState<RoleAudience>("business");
  const tabListRef = React.useRef<HTMLDivElement>(null);

  // Sync with deep-link hash if user arrives targeting a specific personal role
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const checkHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      if (hash === "personal" || hash === "roles-personal" || PERSONAL_ROLE_IDS.has(hash)) {
        setCurrentTab("personal");
      } else if (hash === "all" || hash === "roles-all") {
        setCurrentTab("all");
      }
    };
    window.addEventListener("hashchange", checkHash);
    const timer = setTimeout(checkHash, 0);
    return () => {
      window.removeEventListener("hashchange", checkHash);
      clearTimeout(timer);
    };
  }, []);

  const businessRoles = React.useMemo(
    () => TEMPLATES.filter((role) => role.audience === "business"),
    [],
  );

  const personalRoles = React.useMemo(
    () => TEMPLATES.filter((role) => role.audience === "personal"),
    [],
  );

  const tabs = [
    {
      id: "business" as const,
      label: groups.business,
      shortLabel: "Business",
      count: businessRoles.length,
      icon: Building,
      description: "8 specialized roles to handle support, onboarding, marketing, sales, research, ops, and engineering.",
    },
    {
      id: "personal" as const,
      label: groups.personal,
      shortLabel: "Personal",
      count: personalRoles.length,
      icon: UserRound,
      description: "6 dedicated personal roles for money management, daily admin, social media, career coaching, travel, and learning.",
    },
    {
      id: "all" as const,
      label: "All roles",
      shortLabel: "All",
      count: TEMPLATES.length,
      icon: Sparkles,
      description: "All 14 roles ready to hire — 8 for your business operations and 6 for your personal life.",
    },
  ];

  const currentTabMeta = tabs.find((t) => t.id === currentTab) ?? tabs[0]!;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      setCurrentTab(nextTab.id);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>("button[role='tab']");
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div className="space-y-8">
      {/* Category selector / Segmented control */}
      <div className="flex flex-col items-center">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Filter roles by category"
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface/90 p-1.5 shadow-xs backdrop-blur-md"
        >
          {tabs.map((tab, index) => {
            const active = currentTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`role-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`role-panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setCurrentTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-4",
                  active
                    ? "border border-line/60 bg-surface font-semibold text-ink shadow-xs"
                    : "border border-transparent text-ink-muted hover:bg-surface-2/60 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold transition-colors",
                    active
                      ? "bg-accent-soft text-accent-soft-fg"
                      : "bg-ink/[0.06] text-ink-muted",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Informative description for the current view */}
        <p className="mt-4 max-w-xl text-center text-sm text-ink-muted">
          {currentTabMeta.description}
        </p>
      </div>

      {/* Role Panels */}
      {currentTab === "business" && (
        <section
          role="tabpanel"
          id="role-panel-business"
          aria-labelledby="role-tab-business"
          className="animate-in fade-in duration-200"
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {businessRoles.map((role, index) => (
              <RoleCard key={role.id} role={role} index={index} cta={cta} />
            ))}
          </ul>
        </section>
      )}

      {currentTab === "personal" && (
        <section
          role="tabpanel"
          id="role-panel-personal"
          aria-labelledby="role-tab-personal"
          className="animate-in fade-in duration-200"
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {personalRoles.map((role, index) => (
              <RoleCard key={role.id} role={role} index={index} cta={cta} />
            ))}
          </ul>
        </section>
      )}

      {currentTab === "all" && (
        <div
          role="tabpanel"
          id="role-panel-all"
          aria-labelledby="role-tab-all"
          className="space-y-12 animate-in fade-in duration-200"
        >
          {/* Business Group */}
          <section aria-labelledby="group-heading-business">
            <div className="mb-5 flex items-center justify-between border-b border-line pb-2.5">
              <h3
                id="group-heading-business"
                className="font-hand text-hand-cta font-bold text-ink"
              >
                {groups.business}
              </h3>
              <span className="text-xs font-semibold text-ink-muted">
                {businessRoles.length} roles
              </span>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {businessRoles.map((role, index) => (
                <RoleCard key={role.id} role={role} index={index} cta={cta} />
              ))}
            </ul>
          </section>

          {/* Personal Group */}
          <section aria-labelledby="group-heading-personal">
            <div className="mb-5 flex items-center justify-between border-b border-line pb-2.5">
              <h3
                id="group-heading-personal"
                className="font-hand text-hand-cta font-bold text-ink"
              >
                {groups.personal}
              </h3>
              <span className="text-xs font-semibold text-ink-muted">
                {personalRoles.length} roles
              </span>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {personalRoles.map((role, index) => (
                <RoleCard key={role.id} role={role} index={index} cta={cta} />
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Fallback for environments with JavaScript disabled */}
      <noscript>
        <div className="space-y-12">
          <section aria-labelledby="noscript-roles-business">
            <h3 id="noscript-roles-business" className="mb-5 font-hand text-hand-cta font-bold text-ink">
              {groups.business}
            </h3>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {businessRoles.map((role, index) => (
                <RoleCard key={role.id} role={role} index={index} cta={cta} />
              ))}
            </ul>
          </section>
          <section aria-labelledby="noscript-roles-personal">
            <h3 id="noscript-roles-personal" className="mb-5 font-hand text-hand-cta font-bold text-ink">
              {groups.personal}
            </h3>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {personalRoles.map((role, index) => (
                <RoleCard key={role.id} role={role} index={index} cta={cta} />
              ))}
            </ul>
          </section>
        </div>
      </noscript>
    </div>
  );
}
