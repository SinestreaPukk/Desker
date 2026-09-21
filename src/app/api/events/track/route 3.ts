import { z } from "zod";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { findProject } from "@/lib/projects";
import { track } from "@/lib/product-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  path: z.string().trim().max(500).optional(),
  project: z.string().trim().max(200).optional(),
  metadata: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

/** Client-side usage events (page views, clicks). Best effort; never 500s at the caller. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 204 });
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const project = input.project ? await findProject(input.project, user.id) : null;
  await track({
    name: input.name,
    organizationId: project?.organizationId ?? null,
    userId: user.id,
    path: input.path,
    metadata: input.metadata,
  });
  return new NextResponse(null, { status: 204 });
}
