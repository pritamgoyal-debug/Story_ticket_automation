import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET;

/**
 * In-memory store for pipeline events (most recent per pipeline ID).
 * In production, replace with Redis or a database.
 * SSE clients poll this via /api/pipeline/stream.
 */
const pipelineEvents = new Map<
  number,
  {
    id: number;
    status: string;
    ref: string;
    sha: string;
    duration: number | null;
    createdAt: string;
    finishedAt: string | null;
    builds: Array<{
      id: number;
      name: string;
      status: string;
      stage: string;
    }>;
    updatedAt: number; // Unix ms timestamp of last update
  }
>();

/** Expose the store so the SSE endpoint can read it */
export function getPipelineEvents() {
  return pipelineEvents;
}

/**
 * POST /api/webhook/gitlab
 *
 * Receives GitLab pipeline webhook events.
 * Configure in GitLab: Settings > Webhooks > Pipeline events
 * URL: https://<your-app>/api/webhook/gitlab
 * Secret Token: same value as GITLAB_WEBHOOK_SECRET env var
 */
export async function POST(request: NextRequest) {
  // Verify webhook secret
  const token = request.headers.get("x-gitlab-token");
  if (WEBHOOK_SECRET && token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const kind = payload.object_kind;

    if (kind !== "pipeline") {
      return NextResponse.json({ ignored: true, reason: `Unhandled event: ${kind}` });
    }

    const attrs = payload.object_attributes;
    const pipelineId: number = attrs.id;

    // Store the event
    pipelineEvents.set(pipelineId, {
      id: pipelineId,
      status: attrs.status,
      ref: attrs.ref,
      sha: attrs.sha,
      duration: attrs.duration,
      createdAt: attrs.created_at,
      finishedAt: attrs.finished_at,
      builds: (payload.builds || []).map(
        (b: { id: number; name: string; status: string; stage: string }) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          stage: b.stage,
        })
      ),
      updatedAt: Date.now(),
    });

    // Prune old entries (keep last 50 pipelines)
    if (pipelineEvents.size > 50) {
      const sorted = [...pipelineEvents.entries()].sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt
      );
      for (let i = 0; i < sorted.length - 50; i++) {
        pipelineEvents.delete(sorted[i][0]);
      }
    }

    return NextResponse.json({ received: true, pipelineId, status: attrs.status });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
