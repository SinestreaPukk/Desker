import { handle, parseJson, HttpError } from "@/lib/platform/api";
import { resetPassword } from "@/lib/auth/password-reset";
import { passwordProblem } from "@/lib/auth/password-check";
import { passwordResetSchema } from "@/lib/shared/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets the new password from a reset link. */
export async function POST(request: Request) {
  return handle(async () => {
    const { token, password } = await parseJson(request, passwordResetSchema);
    const weak = await passwordProblem(password);
    if (weak) throw new HttpError(422, weak, { fieldErrors: { password: [weak] } });
    if (!(await resetPassword(token, password))) {
      throw new HttpError(400, "This reset link has expired or was already used. Ask for a new one.");
    }
    return { ok: true };
  });
}
