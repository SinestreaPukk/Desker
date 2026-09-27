import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { readOptOutToken, suppress } from "@/lib/email-optout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Records an unsubscribe. Two callers: the confirm button on
 * /unsubscribe/[token] (a form post, answered with a redirect back to the
 * page), and a mail app's own Unsubscribe button (RFC 8058 one-click, answered
 * with 200). No sign-in: the signed token is the permission.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const optOut = readOptOutToken(token);
  if (!optOut) return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 });

  const form = await request.formData().catch(() => null);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const typed = String(form?.get("email") ?? "").trim().toLowerCase();
  const email = optOut.email ?? (EMAIL.test(typed) ? typed : null);
  const page = new URL(`/unsubscribe/${token}`, request.url);

  if (!email) {
    page.searchParams.set("error", "1");
    return NextResponse.redirect(page, 303);
  }
  const organization = await prisma.organization.findUnique({ where: { id: optOut.organizationId }, select: { id: true } });
  if (organization) {
    await suppress(organization.id, email);
    await audit({
      organizationId: organization.id,
      actorType: "system",
      action: "email.unsubscribed",
      metadata: { email },
    });
  }
  if (oneClick) return new NextResponse(null, { status: 200 });
  page.searchParams.set("done", "1");
  return NextResponse.redirect(page, 303);
}
