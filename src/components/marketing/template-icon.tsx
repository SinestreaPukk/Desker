import * as React from "react";
import { AtSign, CalendarHeart, GraduationCap, Dumbbell, Plane, Rocket, Wallet } from "lucide-react";
import type { TEMPLATE_ICONS } from "@/lib/content";
import { SparklesCuteIcon, ScratchCuteIcon } from "@/components/icons/role-icons";

export { SparklesCuteIcon, ScratchCuteIcon };

const ICONS: Record<(typeof TEMPLATE_ICONS)[number], React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  "calendar-heart": CalendarHeart,
  "at-sign": AtSign,
  rocket: Rocket,
  plane: Plane,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
};

export function TemplateIcon({
  icon,
  className,
}: {
  icon: (typeof TEMPLATE_ICONS)[number] | string;
  className?: string;
}) {
  const Icon = ICONS[icon as (typeof TEMPLATE_ICONS)[number]] ?? SparklesCuteIcon;

  return <Icon className={className} />;
}
