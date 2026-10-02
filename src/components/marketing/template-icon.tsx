import * as React from "react";
import { AtSign, CalendarHeart, GraduationCap, Plane, Rocket, Wallet } from "lucide-react";
import type { TEMPLATE_ICONS } from "@/lib/content";
import {
  CustomerSupportIcon,
  ClientOnboardingIcon,
  ResearcherIcon,
  MarketerIcon,
  SecretaryIcon,
  DevSupportIcon,
  SalesDevIcon,
  PeopleOpsIcon,
  SparklesCuteIcon,
  ScratchCuteIcon,
} from "@/components/icons/role-icons";

export {
  CustomerSupportIcon,
  ClientOnboardingIcon,
  ResearcherIcon,
  MarketerIcon,
  SecretaryIcon,
  DevSupportIcon,
  SalesDevIcon,
  PeopleOpsIcon,
  SparklesCuteIcon,
  ScratchCuteIcon,
};

const ICONS: Record<
  (typeof TEMPLATE_ICONS)[number],
  React.ComponentType<{ className?: string }>
> = {
  // Customer support
  headset: CustomerSupportIcon,
  "life-buoy": CustomerSupportIcon,

  // Client onboarding
  compass: ClientOnboardingIcon,
  route: ClientOnboardingIcon,

  // Researcher
  "file-search": ResearcherIcon,
  search: ResearcherIcon,

  // Marketer / Social media
  "trending-up": MarketerIcon,
  megaphone: MarketerIcon,

  // Secretary / Executive assistant
  briefcase: SecretaryIcon,
  calendar: SecretaryIcon,

  // Programmer / Dev support
  terminal: DevSupportIcon,
  code: DevSupportIcon,

  // Sales development
  target: SalesDevIcon,

  // HR / People ops
  "heart-handshake": PeopleOpsIcon,
  handshake: PeopleOpsIcon,
  users: PeopleOpsIcon,

  // Fallbacks / accents
  sparkles: SparklesCuteIcon,

  // Personal roles: line icons at the same size as the drawn ones.
  wallet: Wallet,
  "calendar-heart": CalendarHeart,
  "at-sign": AtSign,
  rocket: Rocket,
  plane: Plane,
  "graduation-cap": GraduationCap,
};

/** Direct mapping by role template ID for convenience */
const ROLE_ICONS_BY_ID: Record<string, React.ComponentType<{ className?: string }>> = {
  "client-onboarding": ClientOnboardingIcon,
  researcher: ResearcherIcon,
  marketer: MarketerIcon,
  secretary: SecretaryIcon,
  "dev-support": DevSupportIcon,
  "sales-development": SalesDevIcon,
  "people-ops": PeopleOpsIcon,
};

export function TemplateIcon({
  icon,
  className,
}: {
  icon: (typeof TEMPLATE_ICONS)[number] | string;
  className?: string;
}) {
  const Icon =
    ICONS[icon as (typeof TEMPLATE_ICONS)[number]] ??
    ROLE_ICONS_BY_ID[icon] ??
    SparklesCuteIcon;

  return <Icon className={className} />;
}
