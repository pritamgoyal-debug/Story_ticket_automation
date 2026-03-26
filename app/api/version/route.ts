import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITLAB_TOKEN = process.env.GITLAB_ACCESS_TOKEN;
const BASE_URL = "https://scm.intermesh.net/api/v4";
const PROJECT_ID = 624;

export async function GET(request: NextRequest) {
  const branch = request.nextUrl.searchParams.get("branch") || "main";

  if (!GITLAB_TOKEN) {
    return NextResponse.json({ error: "Server token not configured" }, { status: 500 });
  }

  try {
    // Fetch build.gradle from GitLab repository
    const encodedPath = encodeURIComponent("indiaMARTApp/build.gradle");
    const res = await fetch(
      `${BASE_URL}/projects/${PROJECT_ID}/repository/files/${encodedPath}/raw?ref=${branch}`,
      { headers: { "PRIVATE-TOKEN": GITLAB_TOKEN } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch build.gradle (${res.status})` },
        { status: res.status }
      );
    }

    const content = await res.text();

    // Extract versionCode
    const codeMatch = content.match(/versionCode\s+(\d+)/);
    const versionCode = codeMatch ? codeMatch[1] : null;

    // Extract versionName
    const nameMatch = content.match(/versionName\s+"([^"]+)"/);
    const versionName = nameMatch ? nameMatch[1] : null;

    return NextResponse.json({ versionCode, versionName, branch });
  } catch {
    return NextResponse.json({ error: "Failed to fetch version info" }, { status: 502 });
  }
}
