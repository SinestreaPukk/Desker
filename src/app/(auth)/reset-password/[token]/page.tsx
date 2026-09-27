import type { Metadata } from "next";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/ui/panel";
import { BrandLockup } from "@/components/brand-logo";
import { resetLinkUsable } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (await resetLinkUsable(token)) return <ResetPasswordForm token={token} />;
  return (
    <div className="space-y-6">
      <div>
        <BrandLockup />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">This link has expired</h1>
      </div>
      <Panel className="window shadow-md">
        <PanelBody className="space-y-4 p-6 text-sm text-ink sm:p-7">
          <p>Reset links work once, for one hour. This one has been used or is too old.</p>
          <Link href="/forgot-password" className="font-medium text-accent hover:underline">
            Send me a new link
          </Link>
        </PanelBody>
      </Panel>
    </div>
  );
}
