import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITLAB_TOKEN = process.env.GITLAB_ACCESS_TOKEN;
const BASE_URL = "https://scm.intermesh.net/api/v4";
const PROJECT_ID = 624;

export async function POST(request: NextRequest) {
  const { pipelineId } = await request.json();

  if (!pipelineId) {
    return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
  }

  if (!GITLAB_TOKEN) {
    return NextResponse.json({ error: "Server token not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${BASE_URL}/projects/${PROJECT_ID}/pipelines/${pipelineId}/cancel`,
      {
        method: "POST",
        headers: { "PRIVATE-TOKEN": GITLAB_TOKEN },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `GitLab cancel failed (${res.status}): ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ status: data.status, message: "Pipeline cancelled" });
  } catch {
    return NextResponse.json({ error: "Failed to reach GitLab" }, { status: 502 });
  }
}
