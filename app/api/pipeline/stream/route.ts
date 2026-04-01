import { NextRequest } from "next/server";
import { getPipelineEvents } from "../../webhook/gitlab/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/stream?pipelineId=<id>
 *
 * Server-Sent Events (SSE) endpoint for real-time pipeline updates.
 * Reads from the in-memory webhook event store.
 *
 * The client opens an EventSource connection. When a GitLab webhook
 * fires, the event store is updated, and this SSE loop pushes the
 * new status to the connected client.
 *
 * Fallback: if no webhooks arrive within 15s, the client should
 * fall back to polling /api/pipeline with exponential backoff.
 */
export async function GET(request: NextRequest) {
  const pipelineId = request.nextUrl.searchParams.get("pipelineId");

  if (!pipelineId) {
    return new Response("pipelineId query param required", { status: 400 });
  }

  const pid = parseInt(pipelineId, 10);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastSeen = 0;
      let tickCount = 0;
      const MAX_TICKS = 120; // 2 minutes max per SSE connection (client reconnects)

      const interval = setInterval(() => {
        tickCount++;

        const event = getPipelineEvents().get(pid);

        if (event && event.updatedAt > lastSeen) {
          lastSeen = event.updatedAt;
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Close stream if pipeline is terminal
          if (["success", "failed", "canceled", "skipped"].includes(event.status)) {
            clearInterval(interval);
            controller.close();
            return;
          }
        }

        // Send keepalive comment every 15s to prevent proxy timeouts
        if (tickCount % 15 === 0) {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        }

        if (tickCount >= MAX_TICKS) {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
