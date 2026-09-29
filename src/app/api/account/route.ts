import { z } from "zod";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { deleteAccount, exportAccount } from "@/lib/account";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download everything: the account and every space it owns, as one JSON file. */
export async function GET() {
  try {
    const { userId } = await requireAdmin();
    const limit = await checkRateLimit(`account-export:${userId}`, 5, 60 * 60_000);
    if (!limit.allowed) {
      return Response.json({ error: `You can download your data again in ${limit.retryAfterSeconds}s.` }, { status: 429 });
    }
    const data = await exportAccount(userId);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="desker-data-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    // The same error shape every other route returns.
    return handle(async () => {
      throw error;
    });
  }
}

const deleteSchema = z.object({
  /** Typed by hand, so a stray click cannot delete an account. */
  confirmEmail: z.string().trim().toLowerCase(),
});

/** Delete the account and every space it solely owns. Cannot be undone. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const input = await parseJson(request, deleteSchema);
    if (input.confirmEmail !== email.toLowerCase()) {
      throw new HttpError(400, "Type your email address exactly to confirm.", {
        fieldErrors: { confirmEmail: ["That isn't your email address."] },
      });
    }
    await deleteAccount(userId);
    return { deleted: true };
  });
}
