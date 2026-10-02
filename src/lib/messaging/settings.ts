/** What the Alerts page shows: this person's settings, channels and spaces. */
import "server-only";
import { prisma } from "@/lib/db";
import { CHANNEL_KINDS, readPrefs, type AlertPrefs, type ChannelKind } from "./prefs";
import QRCode from "qrcode";
import { appHandle, channelAvailable, linkUrl } from "./send";

export interface ChannelDto {
  id: string;
  kind: ChannelKind;
  label: string;
  enabled: boolean;
  linked: boolean;
  lastError: string | null;
  linkCode: string | null;
  linkUrl: string | null;
  /** The same link as a QR code, for linking from a computer: a phone scans it. */
  linkQr: string | null;
  /** Our account's name in the app, for adding it by hand. */
  handle: string | null;
}

export interface AlertSettingsDto {
  prefs: AlertPrefs;
  /** Saved yet? Until then the page fills in the browser's time zone. */
  saved: boolean;
  channels: ChannelDto[];
  available: Record<ChannelKind, boolean>;
  spaces: { id: string; name: string }[];
}

export async function alertSettings(userId: string): Promise<AlertSettingsDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      alertPrefs: true,
      messageChannels: { orderBy: { createdAt: "asc" } },
      memberships: { select: { organization: { select: { id: true, name: true } } } },
    },
  });
  return {
    prefs: readPrefs(user.alertPrefs),
    saved: user.alertPrefs != null,
    channels: await Promise.all(
      user.messageChannels.map(async (channel) => {
        const kind = channel.kind as ChannelKind;
        const url = channel.linkCode ? linkUrl(kind, channel.linkCode) : null;
        return {
          id: channel.id,
          kind,
          label: channel.label,
          enabled: channel.enabled,
          linked: channel.target != null,
          lastError: channel.lastError,
          linkCode: channel.linkCode,
          linkUrl: url,
          linkQr: url ? await QRCode.toDataURL(url, { margin: 1, width: 200 }) : null,
          handle: appHandle(kind),
        };
      }),
    ),
    available: Object.fromEntries(CHANNEL_KINDS.map((kind) => [kind, channelAvailable(kind)])) as Record<ChannelKind, boolean>,
    spaces: user.memberships.map(({ organization }) => ({
      id: organization.id,
      name: organization.name,
    })),
  };
}
