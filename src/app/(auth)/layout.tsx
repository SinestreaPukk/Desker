import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grid flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <BrandMark />
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
