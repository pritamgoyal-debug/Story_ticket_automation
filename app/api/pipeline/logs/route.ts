import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITLAB_TOKEN = process.env.GITLAB_ACCESS_TOKEN;
const BASE_URL = "https://scm.intermesh.net/api/v4";
const PROJECT_ID = 624;

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (!GITLAB_TOKEN) {
    return NextResponse.json({ error: "Server token not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${BASE_URL}/projects/${PROJECT_ID}/jobs/${jobId}/trace`,
      { headers: { "PRIVATE-TOKEN": GITLAB_TOKEN } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch logs (${res.status})` },
        { status: res.status }
      );
    }

    const rawLog = await res.text();

    // Extract last 200 lines for error context (full logs can be huge)
    const lines = rawLog.split("\n");
    const tail = lines.slice(-200).join("\n");

    // Try to find error patterns
    const errorLines = lines.filter(
      (line) =>
        /error|failure|failed|exception|fatal/i.test(line) &&
        !/warning/i.test(line)
    );
    const errorSummary =
      errorLines.length > 0
        ? errorLines.slice(-20).join("\n")
        : "No explicit error lines found. Check the full log tail below.";

    return NextResponse.json({
      errorSummary,
      logTail: tail,
      totalLines: lines.length,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach GitLab" }, { status: 502 });
  }
}
