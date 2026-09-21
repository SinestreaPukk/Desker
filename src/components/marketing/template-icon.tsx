import {
  Calendar,
  Code,
  Handshake,
  Headset,
  Megaphone,
  Route,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { TEMPLATE_ICONS } from "@/lib/content";

const ICONS = {
  headset: Headset,
  route: Route,
  search: Search,
  megaphone: Megaphone,
  calendar: Calendar,
  code: Code,
  handshake: Handshake,
  users: Users,
  sparkles: Sparkles,
} satisfies Record<(typeof TEMPLATE_ICONS)[number], React.ComponentType<{ className?: string }>>;

export function TemplateIcon({
  icon,
  className,
}: {
  icon: (typeof TEMPLATE_ICONS)[number];
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
