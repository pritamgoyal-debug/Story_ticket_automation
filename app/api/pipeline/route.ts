import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITLAB_TOKEN = process.env.GITLAB_ACCESS_TOKEN;
const BASE_URL = "https://scm.intermesh.net/api/v4";
const PROJECT_ID = 624;

interface GitLabJob {
  id: number;
  name: string;
  status: string;
  stage: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  web_url: string;
  artifacts_file?: { filename: string; size: number };
}

interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  web_url: string;
}

export async function GET(request: NextRequest) {
  const pipelineId = request.nextUrl.searchParams.get("pipelineId");

  if (!pipelineId) {
    return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
  }

  if (!GITLAB_TOKEN) {
    return NextResponse.json({ error: "Server token not configured" }, { status: 500 });
  }

  try {
    // Fetch pipeline status
    const pipelineRes = await fetch(
      `${BASE_URL}/projects/${PROJECT_ID}/pipelines/${pipelineId}`,
      { headers: { "PRIVATE-TOKEN": GITLAB_TOKEN } }
    );

    if (!pipelineRes.ok) {
      return NextResponse.json(
        { error: `GitLab API error: ${pipelineRes.status}` },
        { status: pipelineRes.status }
      );
    }

    const pipeline: GitLabPipeline = await pipelineRes.json();

    // Compute timing
    const startedAt = pipeline.started_at || pipeline.created_at;
    const finishedAt = pipeline.finished_at;
    let durationSeconds = pipeline.duration;
    if (!durationSeconds && startedAt) {
      const start = new Date(startedAt).getTime();
      const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
      durationSeconds = Math.round((end - start) / 1000);
    }

    // If pipeline is terminal, fetch jobs for artifacts + failure info
    let artifactJobId: number | null = null;
    let failedJobName: string | null = null;
    let failedJobUrl: string | null = null;
    let jobs: GitLabJob[] = [];

    const isTerminal = ["success", "failed", "canceled"].includes(pipeline.status);
    if (isTerminal || pipeline.status === "running") {
      try {
        const jobsRes = await fetch(
          `${BASE_URL}/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`,
          { headers: { "PRIVATE-TOKEN": GITLAB_TOKEN } }
        );
        if (jobsRes.ok) {
          jobs = await jobsRes.json();

          // Find artifact job
          const jobWithArtifacts = jobs.find(
            (j: GitLabJob) => j.artifacts_file && j.status === "success"
          );
          if (jobWithArtifacts) {
            artifactJobId = jobWithArtifacts.id;
          }

          // Find failed job for error details
          const failedJob = jobs.find((j: GitLabJob) => j.status === "failed");
          if (failedJob) {
            failedJobName = failedJob.name;
            failedJobUrl = failedJob.web_url;
          }
        }
      } catch {
        // Job lookup failed silently — pipeline status still returned
      }
    }

    return NextResponse.json({
      status: pipeline.status,
      ref: pipeline.ref,
      sha: pipeline.sha,
      webUrl: pipeline.web_url,
      startedAt,
      finishedAt,
      durationSeconds,
      artifactJobId,
      failedJobName,
      failedJobUrl,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        status: j.status,
        stage: j.stage,
        webUrl: j.web_url,
        duration: j.duration,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach GitLab" }, { status: 502 });
  }
}
