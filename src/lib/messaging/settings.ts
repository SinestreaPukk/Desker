/** What the Alerts page shows: this person's settings, channels and spaces. */
import "server-only";
import { prisma } from "@/lib/db";
import { spaceKind } from "@/lib/space";
import { CHANNEL_KINDS, readPrefs, type AlertPrefs, type ChannelKind } from "./prefs";
import { channelAvailable, linkUrl } from "./send";

export interface ChannelDto {
  id: string;
  kind: ChannelKind;
  label: string;
  enabled: boolean;
  linked: boolean;
  lastError: string | null;
  linkCode: string | null;
  linkUrl: string | null;
}

export interface AlertSettingsDto {
  prefs: AlertPrefs;
  /** Saved yet? Until then the page fills in the browser's time zone. */
  saved: boolean;
  channels: ChannelDto[];
  available: Record<ChannelKind, boolean>;
  spaces: { id: string; name: string; kind: "business" | "personal" }[];
}

export async function alertSettings(userId: string): Promise<AlertSettingsDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      alertPrefs: true,
      messageChannels: { orderBy: { createdAt: "asc" } },
      memberships: { select: { organization: { select: { id: true, name: true, kind: true } } } },
    },
  });
  return {
    prefs: readPrefs(user.alertPrefs),
    saved: user.alertPrefs != null,
    channels: user.messageChannels.map((channel) => ({
      id: channel.id,
      kind: channel.kind as ChannelKind,
      label: channel.label,
      enabled: channel.enabled,
      linked: channel.target != null,
      lastError: channel.lastError,
      linkCode: channel.linkCode,
      linkUrl: channel.linkCode ? linkUrl(channel.kind as ChannelKind, channel.linkCode) : null,
    })),
    available: Object.fromEntries(CHANNEL_KINDS.map((kind) => [kind, channelAvailable(kind)])) as Record<ChannelKind, boolean>,
    spaces: user.memberships.map(({ organization }) => ({
      id: organization.id,
      name: organization.name,
      kind: spaceKind(organization.kind),
    })),
  };
}
