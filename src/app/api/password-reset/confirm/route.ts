import { handle, parseJson, HttpError } from "@/lib/api";
import { resetPassword } from "@/lib/password-reset";
import { passwordResetSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets the new password from a reset link. */
export async function POST(request: Request) {
  return handle(async () => {
    const { token, password } = await parseJson(request, passwordResetSchema);
    if (!(await resetPassword(token, password))) {
      throw new HttpError(400, "This reset link has expired or was already used. Ask for a new one.");
    }
    return { ok: true };
  });
}
