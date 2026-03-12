"use client";

import { ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TabKey =
  | "home"
  | "review-story-ticket"
  | "mobile-app-story-template"
  | "rebuild-existing-story"
  | "watch-how-it-works-bug-classifier"
  | "classify-bug-priority"
  | "bug-reported-so-far"
  | "indiamart-bug-guidelines"
  | "hp-mp-bugs-status"
  | "current-status"
  | "new-ticket"
  | "watch-how-it-works-sprint"
  | "add-ticket-to-sprint"
  | "play-store-release-automation";
type NavGroupKey =
  | "mobile-app-story-ticket-development"
  | "product-bug-classifier"
  | "product-bug-status"
  | "docs"
  | "sprint-task"
  | "android-build-automation";
type GenericRecord = Record<string, unknown>;

const DEFAULT_OPEN_NAV_GROUPS: Record<NavGroupKey, boolean> = {
  "mobile-app-story-ticket-development": true,
  "product-bug-classifier": false,
  "product-bug-status": false,
  docs: false,
  "sprint-task": false,
  "android-build-automation": false,
};

const CLOSED_NAV_GROUPS: Record<NavGroupKey, boolean> = {
  "mobile-app-story-ticket-development": false,
  "product-bug-classifier": false,
  "product-bug-status": false,
  docs: false,
  "sprint-task": false,
  "android-build-automation": false,
};

const isRecord = (value: unknown): value is GenericRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asText = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

const parseScore = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

const MAIN_SECTION_HEADINGS = new Set([
  "title",
  "business goal",
  "target audience",
  "business problem",
  "business requirement",
  "acceptance criteria",
  "success metrics & evaluation criteria",
  "tracking & instrumentation",
  "experimentation",
  "rollback",
  "expected impact",
  "people",
  "details",
  "figma",
  "figma link",
]);

const SUPPRESSED_ARTIFACT_LINES = new Set([
  "& evaluation criteria",
  "& instrumentation",
  ":",
  "::",
  ".",
]);

const SECTION_HEADING_LABELS: Record<string, string> = {
  title: "Title",
  "business goal": "Business Goal",
  "target audience": "Target Audience",
  "business problem": "Business Problem",
  "business requirement": "Business Requirement",
  "acceptance criteria": "Acceptance Criteria",
  "success metrics & evaluation criteria": "Success Metrics & Evaluation Criteria",
  "tracking & instrumentation": "Tracking & Instrumentation",
  experimentation: "Experimentation",
  rollback: "Rollback",
  "expected impact": "Expected Impact",
  people: "People",
  details: "Details",
  figma: "Figma Link",
  "figma link": "Figma Link",
};

const FIGMA_PLAIN_TEXT_SUBHEADINGS = new Set([
  "ui flow summary",
  "entry points",
  "edge cases & error states",
]);

const normalizeHeadingText = (line: string): string =>
  line
    .replace(/\*\*/g, "")
    .replace(/^\s*\d+[a-z]?[.)]?\s*/i, "")
    .replace(/^[#\-\s]+/, "")
    .replace(/[:\s]*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase();

const getMainHeadingDisplay = (line: string): string => {
  const cleaned = line
    .replace(/^\s*\d+[a-z]?[.)]?\s*/i, "")
    .replace(/\s*[:]+\s*$/, "")
    .trim();
  const normalized = normalizeHeadingText(cleaned);
  if (normalized === "expected impact / business goal") return "Expected Impact";
  return SECTION_HEADING_LABELS[normalized] ?? cleaned;
};

type ParsedLine =
  | { kind: "main"; text: string }
  | { kind: "table"; rows: string[][] }
  | { kind: "list"; listType: "ul" | "ol"; text: string; level: number }
  | { kind: "text"; text: string }
  | { kind: "blank" };

const isTableRow = (line: string): boolean => /^\s*\|?.+\|.+\|?\s*$/.test(line);
const isTableSeparatorRow = (line: string): boolean => /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line);
const parseTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
const isSeparatorCell = (cell: string): boolean => /^:?-{2,}:?$/.test(cell.trim());
const extractUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const markdownMatch = trimmed.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch?.[1]) return markdownMatch[1];

  const directMatch = trimmed.match(/https?:\/\/[^\s)]+/i);
  if (directMatch?.[0]) return directMatch[0];

  if (/^(www\.)?figma\.com\/\S+$/i.test(trimmed)) {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }

  return trimmed;
};

const extractAnchorHref = (html: string): string => {
  const trimmedHtml = html.trim();
  if (!trimmedHtml) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmedHtml, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a"));

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (!href || href.startsWith("#")) continue;
    if (!href.startsWith("https://")) continue;
    if (href.startsWith("https://docs.google.com")) return href;
  }

  return "";
};

const parseTicketIdFromWorkPackageHref = (href: string): string => {
  const segments = href.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1] : "";
};
const renderFigmaValue = (value: string): ReactNode => {
  const figmaLink = value ?? "";
  console.log("Figma link value before render:", figmaLink);
  if (figmaLink && figmaLink.trim() !== "") {
    const trimmedLink = figmaLink.trim();
    const url = extractUrl(trimmedLink);
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="link-primary text-decoration-underline"
      >
        {trimmedLink}
      </a>
    );
  }
  return <span className="text-secondary fst-italic">[Figma link not provided]</span>;
};

const renderInlineMarkup = (text: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  const regex = /(\*\*.+?\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const [fullMatch] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    if (fullMatch.startsWith("**") && fullMatch.endsWith("**")) {
      parts.push(
        <strong key={`${matchIndex}-${fullMatch.length}`}>
          {fullMatch.slice(2, -2)}
        </strong>
      );
    } else if (fullMatch.startsWith("`") && fullMatch.endsWith("`")) {
      parts.push(<code key={`${matchIndex}-${fullMatch.length}`}>{fullMatch.slice(1, -1)}</code>);
    } else {
      parts.push(fullMatch);
    }

    lastIndex = matchIndex + fullMatch.length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const renderCellMarkup = (text: string): ReactNode[] => {
  const parts = text.split(/<br\s*\/?>/gi);
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    nodes.push(...renderInlineMarkup(part));
    if (index < parts.length - 1) {
      nodes.push(<br key={`cell-br-${index}`} />);
    }
  });

  return nodes;
};

const parseLines = (ticket: string): ParsedLine[] => {
  const lines = ticket.split(/\r?\n/);
  const parsed: ParsedLine[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      parsed.push({ kind: "blank" });
      index += 1;
      continue;
    }

    const normalized = normalizeHeadingText(trimmed);
    if (SUPPRESSED_ARTIFACT_LINES.has(normalized)) {
      index += 1;
      continue;
    }

    if (/^\s*[:.]+\s*$/.test(trimmed)) {
      index += 1;
      continue;
    }

    if (/^\s*\d+[.)]\s*$/.test(trimmed)) {
      index += 1;
      continue;
    }

    if (MAIN_SECTION_HEADINGS.has(normalized)) {
      parsed.push({ kind: "main", text: line });
      index += 1;
      continue;
    }

    if (isTableRow(line)) {
      const rows: string[][] = [];
      let tableIndex = index;
      while (tableIndex < lines.length && isTableRow(lines[tableIndex])) {
        rows.push(parseTableRow(lines[tableIndex]));
        tableIndex += 1;
      }
      parsed.push({ kind: "table", rows });
      index = tableIndex;
      continue;
    }

    const bulletMatch = line.match(/^(\s*)(?:[�*-]|•)\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].replace(/\t/g, "    ").length;
      parsed.push({
        kind: "list",
        listType: "ul",
        text: bulletMatch[2],
        level: Math.floor(indent / 2),
      });
      index += 1;
      continue;
    }

    const numberedMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (numberedMatch) {
      const indent = numberedMatch[1].replace(/\t/g, "    ").length;
      parsed.push({
        kind: "list",
        listType: "ol",
        text: numberedMatch[2],
        level: Math.floor(indent / 2),
      });
      index += 1;
      continue;
    }

    parsed.push({ kind: "text", text: line });
    index += 1;
  }

  return parsed;
};

const renderTable = (rows: string[][], keyPrefix: string): ReactNode => {
  if (!rows.length) return null;
  const hasSeparator = rows.length > 1 && isTableSeparatorRow(`|${rows[1].join("|")}|`);
  const headerRow = rows[0] ?? [];
  const bodyRows = (hasSeparator ? rows.slice(2) : rows.slice(1)).filter(
    (row) => !row.every((cell) => isSeparatorCell(cell))
  );

  return (
    <div className="table-responsive mb-3" key={`${keyPrefix}-table`}>
      <table className="table table-bordered align-middle mb-0" style={{ minWidth: "900px" }}>
        <thead className="table-light">
          <tr>
            {headerRow.map((cell, cellIndex) => (
              <th key={`${keyPrefix}-th-${cellIndex}`} className="fw-semibold px-3 py-2 text-start">
                {renderCellMarkup(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={`${keyPrefix}-tr-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${keyPrefix}-td-${rowIndex}-${cellIndex}`}
                  className="px-3 py-2 text-start"
                  style={{ whiteSpace: "normal", overflowWrap: "break-word" }}
                >
                  {renderCellMarkup(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderListTree = (
  lines: ParsedLine[],
  startIndex: number,
  level: number,
  listType: "ul" | "ol",
  keyPrefix: string
): { node: ReactNode; nextIndex: number } => {
  const items: Array<{ text: string; children?: ReactNode }> = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.kind !== "list") break;
    if (line.level < level) break;
    if (line.listType !== listType && line.level === level) break;

    if (line.level > level) {
      if (items.length === 0) {
        const nested = renderListTree(
          lines,
          index,
          line.level,
          line.listType,
          `${keyPrefix}-nested-${index}`
        );
        items.push({ text: "", children: nested.node });
        index = nested.nextIndex;
        continue;
      }

      const nested = renderListTree(
        lines,
        index,
        line.level,
        line.listType,
        `${keyPrefix}-nested-${index}`
      );
      items[items.length - 1].children = nested.node;
      index = nested.nextIndex;
      continue;
    }

    items.push({ text: line.text });
    index += 1;
  }

  const ListTag = listType;
  const node = (
    <ListTag className="mb-3 ps-4 lh-lg">
      {items.map((item, itemIndex) => (
        <li key={`${keyPrefix}-item-${itemIndex}`} className="mb-2">
          {item.text ? renderInlineMarkup(item.text) : null}
          {item.children}
        </li>
      ))}
    </ListTag>
  );

  return { node, nextIndex: index };
};

const renderContentLines = (
  lines: ParsedLine[],
  keyPrefix: string,
  currentSectionHeading?: string
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let index = 0;
  let renderedFigmaLine = false;
  const normalizedSectionHeading = normalizeHeadingText(currentSectionHeading ?? "");
  const inFigmaSection =
    normalizedSectionHeading === "figma link" || normalizedSectionHeading === "figma";
  const bulletsDisabledForSection =
    normalizedSectionHeading === "acceptance criteria" ||
    normalizedSectionHeading === "success metrics & evaluation criteria";

  const shouldRenderAsBulletBlock = (textLines: ParsedLine[]): boolean => {
    const plainTextLines = textLines.filter((item): item is Extract<ParsedLine, { kind: "text" }> => item.kind === "text");
    if (plainTextLines.length < 2) return false;
    const meaningfulCount = plainTextLines.filter((item) => item.text.trim().length > 0).length;
    return meaningfulCount >= 2;
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.kind === "blank") {
      nodes.push(<div key={`${keyPrefix}-blank-${index}`} className="mb-3" />);
      index += 1;
      continue;
    }

    if (line.kind === "text") {
      if (inFigmaSection) {
        const normalizedLineText = normalizeHeadingText(line.text);
        const isPlainTextSubheading = FIGMA_PLAIN_TEXT_SUBHEADINGS.has(normalizedLineText);
        const figmaCandidate = extractUrl(line.text);
        if (!isPlainTextSubheading && figmaCandidate && figmaCandidate.trim() !== "") {
          renderedFigmaLine = true;
          nodes.push(
            <div key={`${keyPrefix}-text-${index}`} className="mb-3 lh-lg">
              {renderFigmaValue(figmaCandidate)}
            </div>
          );
          index += 1;
          continue;
        }
      }

      if (!bulletsDisabledForSection && !inFigmaSection) {
        const textBlock: Array<Extract<ParsedLine, { kind: "text" }>> = [];
        let blockIndex = index;
        while (blockIndex < lines.length && lines[blockIndex].kind === "text") {
          textBlock.push(lines[blockIndex] as Extract<ParsedLine, { kind: "text" }>);
          blockIndex += 1;
        }

        if (shouldRenderAsBulletBlock(textBlock)) {
          nodes.push(
            <ul key={`${keyPrefix}-autobullets-${index}`} className="mb-3 ps-4 lh-lg">
              {textBlock.map((textLine, itemIndex) => {
                const labelMatch = textLine.text.match(/^\s*([A-Za-z][A-Za-z0-9 /&()'-]{1,45}):\s*(.+)?$/);
                if (labelMatch) {
                  const label = labelMatch[1].trim();
                  const value = labelMatch[2] ?? "";
                  return (
                    <li key={`${keyPrefix}-autobullet-item-${index}-${itemIndex}`} className="mb-2">
                      <strong>{label}:</strong> {renderInlineMarkup(value)}
                    </li>
                  );
                }

                return (
                  <li key={`${keyPrefix}-autobullet-item-${index}-${itemIndex}`} className="mb-2">
                    {renderInlineMarkup(textLine.text)}
                  </li>
                );
              })}
            </ul>
          );
          index = blockIndex;
          continue;
        }
      }

      const labelMatch = line.text.match(/^\s*([A-Za-z][A-Za-z0-9 /&()'-]{1,45}):\s*(.+)?$/);
      if (labelMatch) {
        const label = labelMatch[1].trim();
        const value = labelMatch[2] ?? "";
        const normalizedLabel = normalizeHeadingText(label);
        const isFigmaLabel = normalizedLabel.includes("figma");
        if (isFigmaLabel) {
          renderedFigmaLine = true;
        }
        nodes.push(
          <div key={`${keyPrefix}-label-${index}`} className="mb-3 lh-lg">
            <strong>{label}:</strong> {renderInlineMarkup(value)}
          </div>
        );
        if (isFigmaLabel) {
          nodes.pop();
          nodes.push(
            <div key={`${keyPrefix}-label-${index}`} className="mb-3 lh-lg">
              <strong>Figma Link:</strong> {renderFigmaValue(value)}
            </div>
          );
        }
        index += 1;
        continue;
      }

      nodes.push(
        <div key={`${keyPrefix}-text-${index}`} className="mb-3 lh-lg">
          {renderInlineMarkup(line.text)}
        </div>
      );
      index += 1;
      continue;
    }

    if (line.kind === "table") {
      nodes.push(renderTable(line.rows, `${keyPrefix}-${index}`));
      index += 1;
      continue;
    }

    if (line.kind === "list") {
      const tree = renderListTree(
        lines,
        index,
        line.level,
        line.listType,
        `${keyPrefix}-list-${index}`
      );
      nodes.push(<div key={`${keyPrefix}-listwrap-${index}`}>{tree.node}</div>);
      index = tree.nextIndex;
      continue;
    }

    if (line.kind === "main") {
      nodes.push(
        <div key={`${keyPrefix}-main-${index}`} className="h4 fw-semibold mt-4 mb-3">
          {renderInlineMarkup(getMainHeadingDisplay(line.text))}
        </div>
      );
      index += 1;
      continue;
    }
  }

  if (inFigmaSection && !renderedFigmaLine) {
    nodes.push(
      <div key={`${keyPrefix}-figma-placeholder`} className="mb-3 lh-lg">
        {renderFigmaValue("")}
      </div>
    );
  }

  return nodes;
};

const renderFormattedTicket = (ticket: string): ReactNode[] => {
  const parsed = parseLines(ticket);
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < parsed.length) {
    const line = parsed[index];

    if (line.kind === "main") {
      const sectionLines: ParsedLine[] = [];
      const headingKey = `main-${index}`;
      index += 1;

      while (index < parsed.length && parsed[index].kind !== "main") {
        sectionLines.push(parsed[index]);
        index += 1;
      }

      nodes.push(
        <div key={headingKey} className="mt-4 mb-4 pb-3 border-bottom border-light-subtle">
          <div className="h4 fw-semibold mb-3">{renderInlineMarkup(getMainHeadingDisplay(line.text))}</div>
          {renderContentLines(sectionLines, headingKey, line.text)}
        </div>
      );
      continue;
    }

    nodes.push(...renderContentLines([line], `root-${index}`, undefined));
    index += 1;
  }

  return nodes;
};
const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapWebhookPayload = (value: unknown): unknown => {
  const parsed = parseJsonIfString(value);

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return null;
    return unwrapWebhookPayload(parsed[0]);
  }

  if (!isRecord(parsed)) return parsed;

  if ("json" in parsed) {
    return unwrapWebhookPayload(parsed.json);
  }

  if ("body" in parsed) {
    return unwrapWebhookPayload(parsed.body);
  }

  if ("data" in parsed) {
    return unwrapWebhookPayload(parsed.data);
  }

  if ("result" in parsed) {
    return unwrapWebhookPayload(parsed.result);
  }

  if ("response" in parsed) {
    return unwrapWebhookPayload(parsed.response);
  }

  return parsed;
};

const renderNewTicketResult = (result: unknown): ReactNode => {
  if (!result) return null;

  if (typeof result === "string") {
    return (
      <div className="alert alert-info border-0 shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <span>{"\u2139\uFE0F"}</span>
          <div>{result}</div>
        </div>
      </div>
    );
  }

  const data = isRecord(result) ? result : {};


  // Extract fields with flexible naming (matching exact webhook keys)
  const ticketId = asText(data.ticket_id || data.ticketId || data.id || "N/A");
  const bifurcationStatus = asText(data.bifurcation_status || data.bifurcationStatus || data.status || "N/A");
  const confidenceScore = asText(data.confidence_score || data.confidenceScore || data.confidence || "N/A");
  const bifurcationJustification = asText(
    data.Bifurcation_justification ||
    data.bifurcation_justification ||
    data.bifurcationJustification ||
    data.justification ||
    "N/A"
  );
  const aiSummary = asText(
    (data as Record<string, unknown>)["AI Summary"] ||
    data.ai_summary ||
    data.aiSummary ||
    data.summary ||
    "N/A"
  );

  return (
    <div className="d-grid gap-3">
      {/* Row 1: Ticket ID and Bifurcation Status */}
      <div className="card border-0 shadow-sm p-3" style={{ borderRadius: "12px" }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex flex-column">
            <span className="text-muted small fw-semibold text-uppercase">Ticket ID</span>
            <span className="h5 mb-0 fw-bold text-dark">{ticketId}</span>
          </div>
          <div className="card bg-primary text-white border-0 shadow-sm px-4 py-2" style={{ borderRadius: "10px" }}>
            <div className="small text-white-50 text-uppercase fw-bold" style={{ fontSize: "0.7rem" }}>Bifurcation Status</div>
            <div className="fw-bold">{bifurcationStatus}</div>
          </div>
        </div>
      </div>

      {/* Row 2: Confidence Score */}
      <div className="card border-0 shadow-sm p-3" style={{ borderRadius: "12px" }}>
        <div className="d-flex flex-column">
          <span className="text-muted small fw-semibold text-uppercase mb-1">Confidence Score</span>
          <div className="d-flex align-items-center gap-2">
            <div className="progress flex-grow-1" style={{ height: "8px" }}>
              <div 
                className="progress-bar bg-success" 
                role="progressbar" 
                style={{ width: confidenceScore.includes("%") ? confidenceScore : `${parseFloat(confidenceScore) * 100}%` }}
              ></div>
            </div>
            <span className="fw-bold text-success">{confidenceScore}</span>
          </div>
        </div>
      </div>

      {/* Row 3: Bifurcation Justification */}
      <div className="card border-0 shadow-sm p-3" style={{ borderRadius: "12px" }}>
        <div className="d-flex flex-column">
          <span className="text-muted small fw-semibold text-uppercase mb-2">Bifurcation Justification</span>
          <p className="mb-0 text-dark lh-base">{bifurcationJustification}</p>
        </div>
      </div>

      {/* Row 4: AI Summary */}
      <div className="card border-0 shadow-sm p-3" style={{ borderRadius: "12px" }}>
        <div className="d-flex flex-column">
          <span className="text-muted small fw-semibold text-uppercase mb-2">AI Summary</span>
          <p className="mb-0 text-dark lh-base">{aiSummary}</p>
        </div>
      </div>
     
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [ticketId, setTicketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<unknown | null>(null);
  const [reconstructTicketId, setReconstructTicketId] = useState("");
  const [reconstructLoading, setReconstructLoading] = useState(false);
  const [reconstructError, setReconstructError] = useState<string>("");
  const [reconstructResponse, setReconstructResponse] = useState<string | null>(null);
  const [classifyTicketId, setClassifyTicketId] = useState("");
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  const [classifyResult, setClassifyResult] = useState<{
    activityId: string;
    ticketId: string;
    workPackageTitle: string;
    googleFormUrl: string;
    activityUrl: string;
  } | null>(null);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [openNavGroups, setOpenNavGroups] =
    useState<Record<NavGroupKey, boolean>>(DEFAULT_OPEN_NAV_GROUPS);
  const [savedOpenNavGroups, setSavedOpenNavGroups] = useState<Record<NavGroupKey, boolean> | null>(
    null
  );
  const [isMissingOpen, setIsMissingOpen] = useState(true);
  const [isWeakOpen, setIsWeakOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(true);
  const [isBasicTemplateOpen, setIsBasicTemplateOpen] = useState(true);
  const [isBotTemplateOpen, setIsBotTemplateOpen] = useState(false);
  const [newTicketId, setNewTicketId] = useState("");
  const [newTicketLoading, setNewTicketLoading] = useState(false);
  const [newTicketError, setNewTicketError] = useState("");
  const [newTicketResult, setNewTicketResult] = useState<unknown | null>(null);

  const handleGenerate = async () => {
    const trimmedId = ticketId.trim();

    if (!trimmedId) {
      alert("Please enter a Ticket ID");
      return;
    }

    if (!/^\d+$/.test(trimmedId)) {
      alert("Ticket ID must be numeric");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://imworkflow.intermesh.net/webhook/1dce0367-3e65-4916-a699-e40c5362a9d7",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ticketId: trimmedId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const rawText = await response.text();
      const parsedResponse = parseJsonIfString(rawText);
      console.log("Parsed Response Surajj :", JSON.stringify(parsedResponse, null, 2));
      setReport(unwrapWebhookPayload(parsedResponse));
    } catch (error) {
      console.error(error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleReconstructTicket = async () => {
    const trimmedId = reconstructTicketId.trim();

    if (!trimmedId) {
      setReconstructError("Please enter a Ticket ID");
      return;
    }

    setReconstructLoading(true);
    setReconstructError("");
    setReconstructResponse(null);

    try {
      const response = await fetch(
        "https://imworkflow.intermesh.net/webhook/a2172f04-2922-4b4d-bbaa-9c5eebe997ea",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ticket_id: trimmedId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const rawText = await response.text();
      const parsedResponse = parseJsonIfString(rawText);
      const finalTicket = isRecord(parsedResponse)
        ? asText(parsedResponse.final_ticket)
        : "";

      if (!finalTicket) {
        throw new Error("Missing final_ticket in webhook response");
      }

      setReconstructResponse(finalTicket);
    } catch (error) {
      console.error(error);
      setReconstructError(getErrorMessage(error));
    } finally {
      setReconstructLoading(false);
    }
  };

  const handleClassifyBug = async () => {
    const trimmedId = classifyTicketId.trim();

    if (!trimmedId) {
      setClassifyError("Failed to classify ticket. Please check the ticket ID and try again.");
      return;
    }

    setClassifyLoading(true);
    setClassifyError("");
    setClassifyResult(null);

    try {
      const response = await fetch(
        `https://imworkflow.intermesh.net/webhook/indiamart_bug_priority_classifier_1?ticket_id=${encodeURIComponent(trimmedId)}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const rawText = await response.text();
      const parsedResponse = unwrapWebhookPayload(parseJsonIfString(rawText));
      const payload = isRecord(parsedResponse) ? parsedResponse : null;

      if (!payload) {
        throw new Error("Unexpected response shape");
      }

      const activityId = asText(payload.id);
      const links = isRecord(payload._links) ? payload._links : {};
      const workPackage = isRecord(links.workPackage) ? links.workPackage : {};
      const workPackageTitle = asText(workPackage.title);
      const workPackageHref = asText(workPackage.href);
      const parsedTicketId = parseTicketIdFromWorkPackageHref(workPackageHref);
      const comment = isRecord(payload.comment) ? payload.comment : {};
      const commentHtml = asText(comment.html);
      const googleFormUrl = extractAnchorHref(commentHtml);

      if (!activityId || !workPackageTitle || !parsedTicketId || !googleFormUrl) {
        throw new Error("Missing required values in response");
      }

      setClassifyResult({
        activityId,
        ticketId: parsedTicketId,
        workPackageTitle,
        googleFormUrl,
        activityUrl: `https://project.intermesh.net/projects/android/work_packages/${parsedTicketId}/activity`,
      });
    } catch (error) {
      console.error(error);
      setClassifyError("Failed to classify ticket. Please check the ticket ID and try again.");
    } finally {
      setClassifyLoading(false);
    }
  };

  const handleNewTicketSubmit = async () => {
    const trimmedId = newTicketId.trim();
    if (!trimmedId) {
      setNewTicketError("Please enter a Ticket ID.");
      return;
    }
    setNewTicketLoading(true);
    setNewTicketError("");
    setNewTicketResult(null);

    try {
      const response = await fetch(
        "https://imworkflow.intermesh.net/webhook/classify-ticket",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ticketId: trimmedId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      const rawText = await response.text();
      const parsedResponse = parseJsonIfString(rawText);
      const unwrapped = unwrapWebhookPayload(parsedResponse);
     
      setNewTicketResult(unwrapped);
    } catch (error) {
      console.error(error);
      setNewTicketError(getErrorMessage(error));
    } finally {
      setNewTicketLoading(false);
    }
  };

  const navGroups: Array<{
    key: NavGroupKey;
    label: string;
    items: Array<{ key: TabKey; label: string; showNumber?: boolean; emphasize?: boolean }>;
  }> = [
    {
      key: "mobile-app-story-ticket-development",
      label: "Mobile App Story Ticket Development",
      items: [
        {
          key: "mobile-app-story-template",
          label: "Mobile App Story Template",
        },
        {
          key: "rebuild-existing-story",
          label: "Rebuild Existing Story",
        },
        {
          key: "review-story-ticket",
          label: "Review Story Ticket",
        },
      ],
    },
    {
      key: "product-bug-classifier",
      label: "Product Bug Classifier",
      items: [
        {
          key: "watch-how-it-works-bug-classifier",
          label: "Watch How It Works",
          showNumber: false,
          emphasize: true,
        },
        {
          key: "classify-bug-priority",
          label: "Classify Bug Priority",
        },
        {
          key: "bug-reported-so-far",
          label: "Bug Reported So Far",
        },
      ],
    },
    {
      key: "product-bug-status",
      label: "Product Bug Status",
      items: [
        {
          key: "hp-mp-bugs-status",
          label: "HP + MP Bugs Status Classification",
        },
        {
          key: "current-status",
          label: "Current Release Bugs Classification",
        },
        {
          key: "new-ticket",
          label: "Ticket Status",
        },
      ],
    },
    {
      key: "docs",
      label: "Docs",
      items: [
        {
          key: "indiamart-bug-guidelines",
          label: "IndiaMART Bug Guidelines",
        },
      ],
    },
    {
      key: "sprint-task",
      label: "Sprint Task",
      items: [
        {
          key: "watch-how-it-works-sprint",
          label: "Watch How It Works",
          showNumber: false,
          emphasize: true,
        },
        {
          key: "add-ticket-to-sprint",
          label: "Add Ticket To Sprint",
        },
      ],
    },
    {
      key: "android-build-automation",
      label: "Android Build Automation",
      items: [
        {
          key: "play-store-release-automation",
          label: "Play Store Release Automation",
        },
      ],
    },
  ];

  const normalizedReport = useMemo(() => {
    if (!report) return null;

    const normalized = Array.isArray(report) ? report[0] : report;
    const data = isRecord(normalized) ? normalized : {};
    const header = isRecord(data?.report_header) ? data.report_header : {};
    const ticketDetails = isRecord(data?.ticket_details) ? data.ticket_details : {};
    const summary = isRecord(data?.summary) ? data.summary : {};
    const fullScoreBreakdown = isRecord(data?.full_score_breakdown) ? data.full_score_breakdown : {};
    const rawMissing = Array.isArray(data?.missing_sections) ? data.missing_sections : [];
    const rawWeak = Array.isArray(data?.weak_sections) ? data.weak_sections : [];
    const rawStrengths = Array.isArray(data?.strengths) ? data.strengths : [];
    const rawScoreBreakdown = Array.isArray(fullScoreBreakdown?.section_scores)
      ? fullScoreBreakdown.section_scores
      : [];

    const missingSections = rawMissing.map((item) => (isRecord(item) ? item : {}));
    const weakSections = rawWeak.map((item) => (isRecord(item) ? item : {}));
    const strengths = rawStrengths.map((item) => asText(item)).filter((item) => item.trim().length > 0);
    const scoreBreakdown = rawScoreBreakdown.map((item) => (isRecord(item) ? item : {}));

    return {
      scoreValue: parseScore(header?.score),
      scoreBand: asText(header?.score_band),
      title: asText(header?.title) || "PRODUCT STORY ASSESSMENT",
      ticketId: asText(ticketDetails?.id) || "N/A",
      ticketTitle: asText(ticketDetails?.title) || "Untitled Ticket",
      ticketUrl: asText(ticketDetails?.url),
      missingSections,
      weakSections,
      strengths,
      summary,
      scoreBreakdown,
    };
  }, [report]);

  console.log("NORMALIZED REPORT:", JSON.stringify(normalizedReport, null, 2));

  const scoreBadgeClass =
    normalizedReport?.scoreValue === null || normalizedReport?.scoreValue === undefined
      ? "bg-secondary"
      : normalizedReport?.scoreValue >= 8
        ? "bg-success"
        : normalizedReport?.scoreValue >= 5
          ? "bg-warning text-dark"
          : "bg-danger";

  const getCriticalityBadgeClass = (criticality: string): string => {
    const normalized = criticality.toLowerCase();
    if (normalized.includes("high")) return "bg-danger";
    if (normalized.includes("medium")) return "bg-warning text-dark";
    return "bg-secondary";
  };

  const getScoreBandBadgeClass = (scoreBand: string): string => {
    const normalized = scoreBand.toLowerCase();
    if (normalized.includes("excellent") || normalized.includes("strong")) return "bg-success";
    if (normalized.includes("develop")) return "bg-warning text-dark";
    if (normalized.includes("weak") || normalized.includes("risk")) return "bg-danger";
    return "bg-primary";
  };

  const videoContainerStyle = {
    position: "relative" as const,
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  };

  const videoIframeStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "none",
  };

  return (
    <div className="d-flex min-vh-100 bg-light">
      <aside
        className="bg-white border-end shadow-sm d-flex flex-column"
        style={{
          width: isDrawerCollapsed ? "88px" : "260px",
          transition: "width 0.25s ease",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
          {!isDrawerCollapsed && (
            <span className="fw-bold text-primary">App Team Automations</span>
          )}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => {
              setIsDrawerCollapsed((prev) => {
                const next = !prev;
                if (next) {
                  setSavedOpenNavGroups(openNavGroups);
                  setOpenNavGroups(CLOSED_NAV_GROUPS);
                } else {
                  setOpenNavGroups(savedOpenNavGroups ?? DEFAULT_OPEN_NAV_GROUPS);
                  setSavedOpenNavGroups(null);
                }
                return next;
              });
            }}
            aria-label={
              isDrawerCollapsed
                ? "Expand navigation drawer"
                : "Collapse navigation drawer"
            }
          >
            {isDrawerCollapsed ? ">>" : "<<"}
          </button>
        </div>

        <nav className="p-2 d-grid gap-2">
          {navGroups.map((group) => {
            const isGroupOpen = openNavGroups[group.key];
            return (
              <div key={group.key} className="border rounded">
                <button
                  type="button"
                  className="btn btn-light w-100 text-start d-flex align-items-center justify-content-between fw-semibold"
                  onClick={() =>
                    setOpenNavGroups((prev) => {
                      const isCurrentlyOpen = prev[group.key];
                      // If it's already open, just close it. Otherwise, close all and open this one.
                      if (isCurrentlyOpen) {
                        return { ...prev, [group.key]: false };
                      }
                      const allClosed = Object.fromEntries(
                        Object.keys(prev).map((k) => [k, false])
                      ) as Record<NavGroupKey, boolean>;
                      return { ...allClosed, [group.key]: true };
                    })
                  }
                >
                  <span>{isDrawerCollapsed ? group.label.split(" ")[0] : group.label}</span>
                  <span>{isGroupOpen ? "-" : "+"}</span>
                </button>

                {!isDrawerCollapsed && isGroupOpen && (
                  <div className="d-grid gap-2 p-2 pt-1">
                    {group.items.map((item, index) => {
                      const numberedIndex = group.items
                        .slice(0, index + 1)
                        .filter((candidate) => candidate.showNumber !== false).length;
                      return (
                      <button
                        key={item.key}
                        type="button"
                        className={`btn text-start ps-3 ${
                          activeTab === item.key ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setActiveTab(item.key)}
                      >
                        <span className={item.emphasize ? "fw-bold fst-italic" : undefined}>
                          {item.showNumber === false
                            ? item.label
                            : `${numberedIndex}. ${item.label}`}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="flex-grow-1 p-4">
        <div className="w-100 mx-auto" style={{ maxWidth: "980px" }}>
          {activeTab === "home" ? (
            <div className="d-grid gap-4">
              <div
                className="rounded-4 p-4 p-md-5 text-white shadow-sm"
                style={{ backgroundColor: "#1f2a5a" }}
              >
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <span className="fs-3" aria-hidden="true">
                      {"\u26A1"}
                    </span>
                    <div>
                      <h1 className="h3 fw-bold mb-1 text-white">App Team Automations</h1>
                      <p className="mb-0 text-white-50">Workflow Automation Hub</p>
                    </div>
                  </div>
                  <span className="badge rounded-pill bg-light text-primary fs-6 px-3 py-2">
                    6 Automations
                  </span>
                </div>
              </div>

              <div className="row g-4">
                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\uD83D\uDCF1"} Mobile App Story Ticket Development</h2>
                        <span className="badge bg-primary-subtle text-primary">3 Steps</span>
                      </div>
                      <div className="d-grid gap-2">
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("mobile-app-story-template")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>1</span>
                            <div>
                              <div className="fw-semibold">Mobile App Story Template</div>
                              <div className="small text-muted">Generate story template for mobile app development</div>
                            </div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("rebuild-existing-story")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>2</span>
                            <div>
                              <div className="fw-semibold">Rebuild Existing Story</div>
                              <div className="small text-muted">Reconstruct and rebuild an existing story ticket</div>
                            </div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("review-story-ticket")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>3</span>
                            <div>
                              <div className="fw-semibold">Review Story Ticket</div>
                              <div className="small text-muted">Review and score your story ticket quality</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\uD83D\uDC1B"} Product Bug Classifier</h2>
                        <span className="badge bg-primary-subtle text-primary">2 Steps</span>
                      </div>
                      <div className="d-grid gap-2">
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("watch-how-it-works-bug-classifier")}>
                          <div>
                            <div className="fw-bold fst-italic">Watch How It Works</div>
                            <div className="small text-muted">See how the bug classifier works in action</div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("classify-bug-priority")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>1</span>
                            <div>
                              <div className="fw-semibold">Classify Bug Priority</div>
                              <div className="small text-muted">Classify the priority level of a reported bug</div>
                            </div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("bug-reported-so-far")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>2</span>
                            <div>
                              <div className="fw-semibold">Bug Reported So Far</div>
                              <div className="small text-muted">View all bugs reported across products</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\uD83D\uDCCB"} Product Bug Status</h2>
                        <span className="badge bg-primary-subtle text-primary">3 Items</span>
                      </div>
                      <div className="d-grid gap-2">
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("hp-mp-bugs-status")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>1</span>
                            <div>
                              <div className="fw-semibold">HP + MP Bugs Status Classification</div>
                              <div className="small text-muted">View status of HP and MP product bugs</div>
                            </div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("current-status")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>2</span>
                            <div>
                              <div className="fw-semibold">Current Release Bugs Classification</div>
                              <div className="small text-muted">View status of bugs in current release</div>
                            </div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3" onClick={() => setActiveTab("new-ticket")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>3</span>
                            <div>
                              <div className="fw-semibold">Ticket Status</div>
                              <div className="small text-muted">Check the status of a specific ticket</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\uD83D\uDCC4"} Documentation</h2>
                        <span className="badge bg-primary-subtle text-primary">Docs</span>
                      </div>
                      <button type="button" className="btn btn-light border text-start p-3 w-100" onClick={() => setActiveTab("indiamart-bug-guidelines")}>
                        <div className="d-flex gap-3">
                          <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>1</span>
                          <div>
                            <div className="fw-semibold">IndiaMART Bug Guidelines</div>
                            <div className="small text-muted">Reference documentation for bug reporting standards</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\u2705"} Sprint Task</h2>
                        <span className="badge bg-primary-subtle text-primary">1 Step</span>
                      </div>
                      <div className="d-grid gap-2">
                        <button type="button" className="btn btn-light border text-start p-3 w-100" onClick={() => setActiveTab("watch-how-it-works-sprint")}>
                          <div>
                            <div className="fw-bold fst-italic">Watch How It Works</div>
                            <div className="small text-muted">See how the sprint automation works in action</div>
                          </div>
                        </button>
                        <button type="button" className="btn btn-light border text-start p-3 w-100" onClick={() => setActiveTab("add-ticket-to-sprint")}>
                          <div className="d-flex gap-3">
                            <span className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: "28px", height: "28px" }}>1</span>
                            <div>
                              <div className="fw-semibold">Add Ticket To Sprint</div>
                              <div className="small text-muted">Add a work ticket to the current sprint</div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm h-100">
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h5 fw-bold mb-0">{"\u2699"} Android Build Automation</h2>
                        <span className="badge bg-primary-subtle text-primary">1 Step</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-light border text-start p-3 w-100"
                        onClick={() => setActiveTab("play-store-release-automation")}
                      >
                        <div className="d-flex gap-3">
                          <span
                            className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: "28px", height: "28px" }}
                          >
                            1
                          </span>
                          <div>
                            <div className="fw-semibold">Play Store Release Automation</div>
                            <div className="small text-muted">
                              Access the full Android build and release automation suite
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "review-story-ticket" ? (
            <>
              <div
                className="card shadow-lg p-4 p-md-5 mb-4"
                style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
              >
                <h1 className="mb-4 fw-bold text-primary text-center">Review Story Ticket</h1>
                <p className="text-muted mb-4 text-center">
                  Enter your story ticket ID and generate a quality assessment report
                  instantly.
                </p>

                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Enter Ticket ID (e.g., 602526)"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                />

                <button
                  className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading && (
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                  )}
                  {loading ? "Generating..." : "Generate Report"}
                </button>
              </div>

              {normalizedReport && (
                <section className="card border-0 shadow-sm p-4 p-md-5">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
                    <h2 className="display-6 fw-bold mb-0">{normalizedReport?.title}</h2>
                    <div className="text-md-end">
                      <span className={`badge ${scoreBadgeClass} fs-5 px-4 py-3`}>
                        {normalizedReport?.scoreValue !== null && normalizedReport?.scoreValue !== undefined
                          ? `${normalizedReport.scoreValue.toFixed(2)} / 10`
                          : "N/A"}
                      </span>
                      {normalizedReport?.scoreBand && (
                        <div className="small text-muted mt-2">
                          <strong>Score Band:</strong> {normalizedReport.scoreBand}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card mb-4">
                    <div className="card-body">
                      <h3 className="h5 mb-2">Ticket Details</h3>
                      <p className="mb-2">
                        <strong>Ticket ID:</strong> {normalizedReport?.ticketId}
                      </p>
                      <p className="mb-2">
                        <strong>Ticket Title:</strong> {normalizedReport?.ticketTitle}
                      </p>
                      {normalizedReport?.ticketUrl && (
                        <a
                          href={normalizedReport.ticketUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline-primary btn-sm"
                        >
                          Open Ticket
                        </a>
                      )}
                    </div>
                  </div>

                  {normalizedReport?.missingSections?.length > 0 && (
                    <div className="accordion mb-4">
                      <div className="accordion-item">
                        <h2 className="accordion-header">
                          <button
                            type="button"
                            className={`accordion-button ${isMissingOpen ? "" : "collapsed"}`}
                            onClick={() => setIsMissingOpen((prev) => !prev)}
                            aria-expanded={isMissingOpen}
                          >
                            Missing Sections
                          </button>
                        </h2>
                        {isMissingOpen && (
                          <div className="accordion-body">
                            <div className="row">
                              {normalizedReport.missingSections.map((section, index) => {
                                const sectionName = asText(section.section) || `Section ${index + 1}`;
                                const criticality = asText(section.criticality) || "Medium";
                                const oneLineFix = asText(section.one_line_fix);
                                const whyCritical = asText(section.why_critical);
                                const exampleUpgrade = asText(section.example_upgrade);
                                return (
                                  <div className="col-12 mb-3" key={`${sectionName}-${index}`}>
                                    <div className="border rounded p-3">
                                      <div className="d-flex align-items-center justify-content-between mb-2">
                                        <strong>{sectionName}</strong>
                                        <span className={`badge ${getCriticalityBadgeClass(criticality)}`}>
                                          {criticality}
                                        </span>
                                      </div>
                                      <p className="mb-2">
                                        <strong>One Line Fix:</strong> {oneLineFix || "N/A"}
                                      </p>
                                      <p className="mb-2">
                                        <strong>Why Critical:</strong> {whyCritical || "N/A"}
                                      </p>
                                      <div className="alert alert-light border mb-0">
                                        <strong>Example Upgrade:</strong> {exampleUpgrade || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {normalizedReport?.weakSections?.length > 0 && (
                    <div className="accordion mb-4">
                      <div className="accordion-item">
                        <h2 className="accordion-header">
                          <button
                            type="button"
                            className={`accordion-button ${isWeakOpen ? "" : "collapsed"}`}
                            onClick={() => setIsWeakOpen((prev) => !prev)}
                            aria-expanded={isWeakOpen}
                          >
                            Weak Sections
                          </button>
                        </h2>
                        {isWeakOpen && (
                          <div className="accordion-body">
                            <div className="row">
                              {normalizedReport.weakSections.map((section, index) => {
                                const sectionName = asText(section.section) || `Section ${index + 1}`;
                                const currentScore = asText(section.current_score) || "N/A";
                                const oneLineFix = asText(section.one_line_fix);
                                const whyImprove = asText(section.why_improve);
                                const exampleUpgrade = asText(section.example_upgrade);
                                return (
                                  <div className="col-12 mb-3" key={`${sectionName}-${index}`}>
                                    <div className="border rounded p-3">
                                      <div className="d-flex align-items-center justify-content-between mb-2">
                                        <strong>{sectionName}</strong>
                                        <span className="badge bg-secondary">{currentScore}</span>
                                      </div>
                                      <p className="mb-2">
                                        <strong>One Line Fix:</strong> {oneLineFix || "N/A"}
                                      </p>
                                      <p className="mb-2">
                                        <strong>Why Improve:</strong> {whyImprove || "N/A"}
                                      </p>
                                      <div className="alert alert-light border mb-0">
                                        <strong>Example Upgrade:</strong> {exampleUpgrade || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(asText(normalizedReport?.summary?.overall_assessment) ||
                    asText(normalizedReport?.summary?.what_went_well) ||
                    asText(normalizedReport?.summary?.primary_improvement_direction) ||
                    asText(normalizedReport?.summary?.improvement_path)) && (
                    <div className="accordion mb-4">
                      <div className="accordion-item">
                        <h2 className="accordion-header">
                          <button
                            type="button"
                            className={`accordion-button ${isSummaryOpen ? "" : "collapsed"}`}
                            onClick={() => setIsSummaryOpen((prev) => !prev)}
                            aria-expanded={isSummaryOpen}
                          >
                            Executive Summary
                          </button>
                        </h2>
                        {isSummaryOpen && (
                          <div className="accordion-body">
                            <p className="mb-2">
                              <strong>Overall Assessment:</strong>{" "}
                              <span
                                className={`badge ${getScoreBandBadgeClass(normalizedReport?.scoreBand || "")}`}
                                style={{
                                  whiteSpace: "normal",
                                  overflowWrap: "anywhere",
                                  wordBreak: "break-word",
                                }}
                              >
                                {asText(normalizedReport?.summary?.overall_assessment) || "N/A"}
                              </span>
                            </p>
                            <p className="mb-2">
                              <strong>What Went Well:</strong> {asText(normalizedReport?.summary?.what_went_well) || "N/A"}
                            </p>
                            <p className="mb-2">
                              <strong>Primary Improvement Direction:</strong>{" "}
                              {asText(normalizedReport?.summary?.primary_improvement_direction) || "N/A"}
                            </p>
                            <p className="mb-0">
                              <strong>Improvement Path:</strong> {asText(normalizedReport?.summary?.improvement_path) || "N/A"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {normalizedReport?.strengths?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="h5 mb-3">Strengths</h3>
                      <ul className="list-group">
                        {normalizedReport.strengths.map((strength, index) => (
                          <li key={`${strength}-${index}`} className="list-group-item text-success">
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedReport?.scoreBreakdown?.length > 0 && (
                    <div className="accordion mb-4">
                      <div className="accordion-item">
                        <h2 className="accordion-header">
                          <button
                            type="button"
                            className={`accordion-button ${isBreakdownOpen ? "" : "collapsed"}`}
                            onClick={() => setIsBreakdownOpen((prev) => !prev)}
                            aria-expanded={isBreakdownOpen}
                          >
                            Full Score Breakdown
                          </button>
                        </h2>
                        {isBreakdownOpen && (
                          <div className="accordion-body">
                            <div className="row">
                              {normalizedReport.scoreBreakdown.map((section, index) => {
                                const sectionName = asText(section.section) || `Section ${index + 1}`;
                                const sectionScore = asText(section.score) || "N/A";
                                const sectionDetail = asText(section.detail).trim();
                                return (
                                <div className="col-md-6 mb-3" key={`${sectionName}-${index}`}>
                                  <div className="border rounded p-3 h-100">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                      <strong>{sectionName}</strong>
                                      <span className="badge bg-secondary">{sectionScore}</span>
                                    </div>
                                    {sectionDetail && (
                                      <p className="mb-0 text-muted">{sectionDetail}</p>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!(normalizedReport?.missingSections?.length > 0) &&
                    !(normalizedReport?.weakSections?.length > 0) &&
                    !(normalizedReport?.strengths?.length > 0) &&
                    !(normalizedReport?.scoreBreakdown?.length > 0) && (
                    <div className="mb-4">
                      <p className="text-muted mb-0">No detailed report sections available.</p>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : activeTab === "rebuild-existing-story" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Rebuild Existing Story</h1>

              <div className="mb-3">
                <label htmlFor="reconstruct-ticket-id" className="form-label fw-semibold">
                  Enter Ticket ID
                </label>
                <input
                  id="reconstruct-ticket-id"
                  type="text"
                  className="form-control"
                  value={reconstructTicketId}
                  onChange={(e) => setReconstructTicketId(e.target.value)}
                  placeholder="Enter Ticket ID"
                />
              </div>

              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center"
                onClick={handleReconstructTicket}
                disabled={reconstructLoading}
              >
                {reconstructLoading && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                )}
                {reconstructLoading ? "Reconstructing..." : "Reconstruct Ticket"}
              </button>

              {reconstructError && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {reconstructError}
                </div>
              )}

              {reconstructResponse !== null && (
                <div className="card border mt-4">
                  <div className="card-body">
                    <div className="text-start">
                      {renderFormattedTicket(reconstructResponse)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "classify-bug-priority" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Classify Bug Priority</h1>
              <p className="text-muted mb-4 text-center">
                Enter your ticket ID to classify its bug priority using AI.
              </p>

              <input
                type="text"
                className="form-control mb-3"
                placeholder="Enter Ticket ID"
                value={classifyTicketId}
                onChange={(e) => setClassifyTicketId(e.target.value)}
              />

              <button
                className="btn btn-primary w-100 d-flex justify-content-center align-items-center"
                onClick={handleClassifyBug}
                disabled={classifyLoading}
              >
                {classifyLoading && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                )}
                {classifyLoading ? "Classifying..." : "Classify Bug"}
              </button>

              {classifyError && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {classifyError}
                </div>
              )}

              {classifyResult && (
                <div className="card border mt-4 text-start">
                  <div className="card-body">
                    <h2 className="h5 text-success mb-3">{"\u2705"} Bug Priority Classification Initiated</h2>
                    <p className="mb-2">
                      For ticket id{" "}
                      <a
                        href={`https://project.intermesh.net/projects/android/work_packages/${classifyResult.ticketId}/activity`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-primary text-decoration-underline"
                      >
                        {classifyResult.ticketId}
                      </a>{" "}
                      {"\u2014"}
                    </p>
                    <p className="mb-2">Title: &quot;{classifyResult.workPackageTitle}&quot;</p>
                    <p className="mb-2">
                      Information to make prediction is incomplete. A{" "}
                      <a
                        href={classifyResult.googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-primary text-decoration-underline"
                      >
                        Google Form
                      </a>{" "}
                      with specific questions generated by the bot has been posted in the activity section.
                    </p>
                    <p className="mb-2">
                      After filling the form the bot will process the information and will post the
                      priority in the activity section.
                    </p>
                    <p className="mb-0">
                      For more information on IndiaMART bug guidelines{" "}
                      <button
                        type="button"
                        className="btn btn-link p-0 align-baseline link-primary text-decoration-underline"
                        onClick={() => setActiveTab("indiamart-bug-guidelines")}
                      >
                        click here
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "mobile-app-story-template" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Mobile App Story Template</h1>

              <div className="accordion">
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button
                      type="button"
                      className={`accordion-button ${isBasicTemplateOpen ? "" : "collapsed"}`}
                      onClick={() => setIsBasicTemplateOpen((prev) => !prev)}
                      aria-expanded={isBasicTemplateOpen}
                    >
                      Basic Template
                    </button>
                  </h2>
                  {isBasicTemplateOpen && (
                    <div className="accordion-body">
                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Title</h3>
                        <p className="mb-0 ps-3">Business Goal</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Goal</h3>
                        <p className="mb-2 ps-3">Business Objective:</p>
                        <p className="mb-0 ps-3">Company OKR / Strategic Pillar:</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Target Audience</h3>
                        <p className="mb-2 ps-3">User Type:</p>
                        <p className="mb-0 ps-3">Segment:</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Problem</h3>
                        <p className="mb-2 ps-3">Problem Statement:</p>
                        <p className="mb-2 ps-3">Current User Experience:</p>
                        <p className="mb-2 ps-3">Supporting Data:</p>
                        <p className="mb-2 ps-3">Impact if Not Solved:</p>
                        <p className="mb-0 ps-3">Opportunity Size:</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Requirement</h3>
                        <p className="mb-2 ps-3">Figma Link:</p>
                        <p className="mb-2 ps-3">UI Flow Summary:</p>
                        <p className="mb-2 ps-3">Edge Cases &amp; Error States:</p>
                        <p className="mb-2 ps-4">Offline mode:</p>
                        <p className="mb-2 ps-4">Slow API response:</p>
                        <p className="mb-2 ps-4">Empty state:</p>
                        <p className="mb-2 ps-4">Retry logic:</p>
                        <p className="mb-2 ps-4">Android OS compatibility:</p>
                        <p className="mb-0 ps-4">Backward compatibility:</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-3">Acceptance Criteria</h3>
                        <div className="table-responsive">
                          <table className="table table-bordered align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Scenario</th>
                                <th>Given / When / Then</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>Happy Path: Load Product Details</td>
                                <td></td>
                                <td>Functional</td>
                              </tr>
                              <tr>
                                <td>Error Handling: API Failure</td>
                                <td></td>
                                <td>Error Handling</td>
                              </tr>
                              <tr>
                                <td>Error Handling: Network Offline</td>
                                <td></td>
                                <td>Error Handling</td>
                              </tr>
                              <tr>
                                <td>Performance: Webview Load Time</td>
                                <td></td>
                                <td>Performance</td>
                              </tr>
                              <tr>
                                <td>Negative Test: No Edit Functionality</td>
                                <td></td>
                                <td>Functional</td>
                              </tr>
                              <tr>
                                <td>Android Specific: OS Compatibility</td>
                                <td></td>
                                <td>Compatibility</td>
                              </tr>
                              <tr>
                                <td>Android Specific: Crash-Free</td>
                                <td></td>
                                <td>Stability</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-3">Success Metrics &amp; Evaluation Criteria</h3>
                        <div className="table-responsive">
                          <table className="table table-bordered align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Metric</th>
                                <th>Type</th>
                                <th>Baseline</th>
                                <th>Target</th>
                                <th>Eval Timeline</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>Webview Load Time (Product Details)</td>
                                <td>Primary</td>
                                <td><strong><em>X ms</em></strong></td>
                                <td><strong><em>Y ms</em></strong> (reduction)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Crash-Free Rate (Manage Products Module)</td>
                                <td>Primary</td>
                                <td><strong><em>X%</em></strong></td>
                                <td><strong><em>Y%</em></strong> (increase)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Seller Adoption Rate (Webview Path)</td>
                                <td>Secondary</td>
                                <td><strong><em>N/A</em></strong> (new path)</td>
                                <td><strong><em>X%</em></strong> of sellers viewing product details</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>API Error Rate (Product Details Webview)</td>
                                <td>Secondary</td>
                                <td><strong><em>X%</em></strong></td>
                                <td><strong><em>Y%</em></strong> (reduction)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Overall App Crash Rate</td>
                                <td>Guardrail</td>
                                <td><strong><em>X%</em></strong></td>
                                <td>Maintain below <strong><em>Y%</em></strong></td>
                                <td>Continuous</td>
                              </tr>
                              <tr>
                                <td>Negative Reviews (related to product management)</td>
                                <td>Guardrail</td>
                                <td><strong><em>X reviews/week</em></strong></td>
                                <td>Maintain below <strong><em>Y reviews/week</em></strong></td>
                                <td>Continuous</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Tracking &amp; Instrumentation</h3>
                        <p className="mb-0 ps-3">(empty field)</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Experimentation</h3>
                        <p className="mb-2 ps-3">A/B testing:</p>
                        <p className="mb-0 ps-3">Rollback:</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Expected Impact</h3>
                        <p className="mb-0 ps-3">(empty field)</p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">People</h3>
                        <p className="mb-2 ps-3">Assignee:</p>
                        <p className="mb-0 ps-3">Accountable:</p>
                      </div>

                      <div>
                        <h3 className="h5 fw-bold mb-2">Details</h3>
                        <p className="mb-2 ps-3">Date: (start and end date)</p>
                        <p className="mb-0 ps-3">Priority:</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button
                      type="button"
                      className={`accordion-button ${isBotTemplateOpen ? "" : "collapsed"}`}
                      onClick={() => setIsBotTemplateOpen((prev) => !prev)}
                      aria-expanded={isBotTemplateOpen}
                    >
                      Bot Generated Template Example
                    </button>
                  </h2>
                  {isBotTemplateOpen && (
                    <div className="accordion-body">
                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Title</h3>
                        <p className="mb-0 ps-3">
                          Implement Webview for Product Details View (Read-Only) in Manage Products
                          Module
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Goal</h3>
                        <p className="mb-2 ps-3">
                          Business Objective: Improve release velocity for seller-facing features in
                          the Manage Products module by <strong><em>X%</em></strong> within{" "}
                          <strong><em>Y quarters</em></strong>.
                        </p>
                        <p className="mb-0 ps-3">
                          Company OKR / Strategic Pillar: O2: Modernize Seller Tech Stack -&gt; KR:
                          Reduce average feature release cycle for seller tools by{" "}
                          <strong><em>Z days</em></strong>.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Target Audience</h3>
                        <p className="mb-2 ps-3">User Type: Sellers</p>
                        <p className="mb-0 ps-3">
                          Segment: All Sellers (Free, Paid, Premium) who manage their product
                          listings on the IndiaMART Android App.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Problem</h3>
                        <p className="mb-2 ps-3">
                          Problem Statement: The current native implementation of the Manage Products
                          module creates a dependency on app releases for feature updates and bug
                          fixes, hindering rapid iteration and independent deployment of critical
                          seller-facing functionalities.
                        </p>
                        <p className="mb-2 ps-3">
                          Current User Experience: Sellers currently access product details via a
                          native screen. Any changes require a full app update, leading to delays in
                          delivering value and maintaining feature parity with the web platform.
                        </p>
                        <p className="mb-2 ps-3">
                          Supporting Data: Average time to deploy a new feature or bug fix in the
                          native Manage Products module is <strong><em>X days</em></strong>.{" "}
                          <strong><em>Y%</em></strong> of seller-facing features are delayed due to
                          app release cycles. <strong><em>Z%</em></strong> of support tickets relate to
                          inconsistencies between web and app seller tools.
                        </p>
                        <p className="mb-2 ps-3">
                          Impact if Not Solved: Slower time-to-market for seller tools, competitive
                          disadvantage, increased operational overhead for feature parity, and
                          potential seller dissatisfaction due to outdated app functionalities.
                        </p>
                        <p className="mb-0 ps-3">
                          Opportunity Size: Accelerating feature delivery by{" "}
                          <strong><em>X%</em></strong> for the Manage Products module could lead to a{" "}
                          <strong><em>Y%</em></strong> increase in seller engagement with product
                          listings and a <strong><em>Z%</em></strong> reduction in development cycles.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Business Requirement</h3>
                        <p className="mb-2 ps-3">
                          Figma Link: https://www.figma.com/file/indiaMART_seller_product_details_webview_v1
                        </p>
                        <p className="mb-2 ps-3">UI Flow Summary:</p>
                        <ul className="mb-3 ps-5 lh-lg">
                          <li>Seller navigates to &quot;My Products&quot; section from the Seller Dashboard.</li>
                          <li>Seller taps on a specific product listing from the list.</li>
                          <li>
                            The app loads a Webview displaying the read-only product details page.
                          </li>
                          <li>
                            The Webview renders product name, images, price, description, and other
                            attributes as fetched from the backend API.
                          </li>
                          <li>
                            No edit/add functionality is available in this initial Webview
                            implementation.
                          </li>
                          <li>
                            A &quot;Back&quot; button allows the seller to return to the product list.
                          </li>
                        </ul>
                        <p className="mb-2 ps-3">Edge Cases &amp; Error States:</p>
                        <p className="mb-2 ps-4">
                          Offline mode: Display a standard &quot;No Internet Connection&quot; error page within
                          the Webview or a native toast.
                        </p>
                        <p className="mb-2 ps-4">
                          Slow API response: Display a loading spinner/skeleton UI within the
                          Webview. Timeout after <strong><em>X seconds</em></strong> and show an error.
                        </p>
                        <p className="mb-2 ps-4">
                          Empty state: If product details API returns no data, display a &quot;Product
                          details not found&quot; message.
                        </p>
                        <p className="mb-2 ps-4">
                          Retry logic: Implement a &quot;Retry&quot; button on error states to re-fetch data.
                        </p>
                        <p className="mb-2 ps-4">
                          Android OS compatibility: Ensure Webview functions correctly on Android OS
                          versions <strong><em>X</em></strong> and above.
                        </p>
                        <p className="mb-0 ps-4">
                          Backward compatibility: Ensure existing native product list view continues
                          to function for older app versions.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-3">Acceptance Criteria</h3>
                        <div className="table-responsive">
                          <table className="table table-bordered align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Scenario</th>
                                <th>Given / When / Then</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>Happy Path: Load Product Details</td>
                                <td>
                                  Given the seller is on the &quot;My Products&quot; list. When the seller
                                  taps on a product. Then the Webview loads and displays the
                                  read-only product details within <strong><em>X seconds</em></strong>.
                                </td>
                                <td>Functional</td>
                              </tr>
                              <tr>
                                <td>Error Handling: API Failure</td>
                                <td>
                                  Given the seller taps on a product. When the product details API
                                  call fails. Then the Webview displays &quot;Failed to load product
                                  details. Please try again.&quot; with a Retry button.
                                </td>
                                <td>Error Handling</td>
                              </tr>
                              <tr>
                                <td>Error Handling: Network Offline</td>
                                <td>
                                  Given the seller taps on a product. When the device is offline.
                                  Then the Webview displays a &quot;No Internet Connection&quot; message.
                                </td>
                                <td>Error Handling</td>
                              </tr>
                              <tr>
                                <td>Performance: Webview Load Time</td>
                                <td>
                                  Given the seller taps on a product. When the Webview loads the
                                  product details. Then the content should be visible within{" "}
                                  <strong><em>X ms</em></strong> on a 3G network.
                                </td>
                                <td>Performance</td>
                              </tr>
                              <tr>
                                <td>Negative Test: No Edit Functionality</td>
                                <td>
                                  Given the Webview displays product details. When the seller
                                  attempts to edit any field. Then no editable fields or Edit button
                                  should be present.
                                </td>
                                <td>Functional</td>
                              </tr>
                              <tr>
                                <td>Android Specific: OS Compatibility</td>
                                <td>
                                  Given the app is installed on Android <strong><em>X to Y</em></strong>. When the Webview
                                  loads product details. Then the Webview should render correctly
                                  without UI glitches or crashes.
                                </td>
                                <td>Compatibility</td>
                              </tr>
                              <tr>
                                <td>Android Specific: Crash-Free</td>
                                <td>
                                  Given the Webview is in use for <strong><em>Z minutes</em></strong>. When various
                                  interactions occur. Then the app should remain crash-free.
                                </td>
                                <td>Stability</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-3">Success Metrics &amp; Evaluation Criteria</h3>
                        <div className="table-responsive">
                          <table className="table table-bordered align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Metric</th>
                                <th>Type</th>
                                <th>Baseline</th>
                                <th>Target</th>
                                <th>Eval Timeline</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>Webview Load Time (Product Details)</td>
                                <td>Primary</td>
                                <td><strong><em>X ms</em></strong></td>
                                <td><strong><em>Y ms</em></strong> (reduction)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Crash-Free Rate (Manage Products Module)</td>
                                <td>Primary</td>
                                <td><strong><em>X%</em></strong></td>
                                <td><strong><em>Y%</em></strong> (increase)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Seller Adoption Rate (Webview Path)</td>
                                <td>Secondary</td>
                                <td><strong><em>N/A</em></strong> (new path)</td>
                                <td><strong><em>X%</em></strong> of sellers viewing product details</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>API Error Rate (Product Details Webview)</td>
                                <td>Secondary</td>
                                <td><strong><em>X%</em></strong></td>
                                <td><strong><em>Y%</em></strong> (reduction)</td>
                                <td><strong><em>Z days</em></strong> post-launch</td>
                              </tr>
                              <tr>
                                <td>Overall App Crash Rate</td>
                                <td>Guardrail</td>
                                <td><strong><em>X%</em></strong></td>
                                <td>Maintain below <strong><em>Y%</em></strong></td>
                                <td>Continuous</td>
                              </tr>
                              <tr>
                                <td>Negative Reviews (related to product management)</td>
                                <td>Guardrail</td>
                                <td><strong><em>X reviews/week</em></strong></td>
                                <td>Maintain below <strong><em>Y reviews/week</em></strong></td>
                                <td>Continuous</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Tracking &amp; Instrumentation</h3>
                        <p className="mb-2 ps-3">
                          Event Naming Convention: seller_product_management;&lt;action&gt;;&lt;element&gt;
                        </p>
                        <p className="mb-2 ps-3">
                          Logging Requirements: Client-side (Firebase Analytics, GA4)
                        </p>
                        <p className="mb-2 ps-3">
                          seller_product_management;webview_loaded;product_details: Logged when the
                          product details Webview successfully loads. Parameters: product_id,
                          seller_id, load_time_ms, is_success
                        </p>
                        <p className="mb-2 ps-3">
                          seller_product_management;webview_load_failed;product_details: Logged when
                          the Webview fails to load. Parameters: product_id, seller_id, error_code,
                          error_message
                        </p>
                        <p className="mb-2 ps-3">
                          seller_product_management;viewed;product_details_webview: Logged when a
                          seller views the product details. Parameters: product_id, seller_id,
                          session_duration_sec
                        </p>
                        <p className="mb-2 ps-3">
                          seller_product_management;clicked;retry_button: Logged when a seller clicks
                          Retry. Parameters: product_id, seller_id, error_context
                        </p>
                        <p className="mb-2 ps-3">
                          Funnel stage mapping: Foundational step for the &quot;Manage Products&quot; funnel.
                        </p>
                        <p className="mb-2 ps-3">
                          Experiment tagging key: product_details_webview_rollout
                        </p>
                        <p className="mb-0 ps-3">
                          Drop-off tracking logic: Track
                          seller_product_management;webview_load_failed as a drop-off point.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Experimentation</h3>
                        <p className="mb-2 ps-3">
                          A/B testing: Phased rollout A/B test. Remote config key:
                          enable_product_details_webview (boolean).
                        </p>
                        <p className="mb-2 ps-3">
                          Control Group: Continues to use existing native product details view.
                        </p>
                        <p className="mb-2 ps-3">
                          Variant Group: Sees the new Webview for product details.
                        </p>
                        <p className="mb-2 ps-3">
                          Experiment success trigger metric: Maintain crash-free rate above{" "}
                          <strong><em>X%</em></strong> and Webview load time below{" "}
                          <strong><em>Y ms</em></strong> for the variant group.
                        </p>
                        <p className="mb-0 ps-3">
                          Rollback: Setting enable_product_details_webview remote config key to false
                          will immediately disable the Webview path and revert to the previous native
                          experience.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">Expected Impact</h3>
                        <p className="mb-0 ps-3">
                          This Webview implementation decouples the Manage Products module from the
                          main app release cycle, enabling faster iteration and deployment of
                          seller-facing features. It will lead to improved seller efficiency, a more
                          consistent cross-platform experience, higher seller retention and
                          engagement, and lay the groundwork for future revenue uplift through more
                          dynamic seller tools.
                        </p>
                      </div>

                      <div className="mb-4 pb-3 border-bottom border-light-subtle">
                        <h3 className="h5 fw-bold mb-2">People</h3>
                        <p className="mb-2 ps-3">Assignee: Mansi Gupta</p>
                        <p className="mb-0 ps-3">Accountable: Soumyajeet Sen</p>
                      </div>

                      <div>
                        <h3 className="h5 fw-bold mb-2">Details</h3>
                        <p className="mb-2 ps-3">Date: -</p>
                        <p className="mb-0 ps-3">Priority: Medium</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "hp-mp-bugs-status" ? (
            <div className="card shadow-lg p-4 p-md-5" style={{ width: "100%", borderRadius: "20px" }}>
              <h1 className="mb-4 fw-bold text-primary text-center">HP + MP Product Bugs Status Classification</h1>
              <div className="card border shadow-sm p-4 text-center">
                <p className="mb-4">Click below to join the respective spaces:</p>
                <div className="d-flex flex-column flex-md-row justify-content-center gap-3">
                  <a href="https://mail.google.com/chat/u/0/#chat/space/AAAAuMInwWc" target="_blank" rel="noopener noreferrer" className="btn btn-primary d-flex align-items-center justify-content-center gap-2">
                    <span>Android Space</span>
                  </a>
                  <a href="https://mail.google.com/chat/u/0/#chat/space/AAAAqBfN7_Y" target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2">
                    <span>iOS Space</span>
                  </a>
                </div>
              </div>
            </div>
          ) : activeTab === "current-status" ? (
            <div className="items-center justify-center p-4">
              <div className="card shadow-lg p-4 p-md-5" style={{ width: "100%", borderRadius: "20px" }}>
                <h1 className="mb-4 fw-bold text-primary text-center">Current Release Status</h1>
                <div className="card border shadow-sm p-4 text-center">
                  <p className="mb-4">Click below to join the Current Release Space:</p>
                  <div className="d-flex justify-content-center">
                    <a href="https://mail.google.com/chat/u/0/#chat/space/AAAA_eX6qK4" target="_blank" rel="noopener noreferrer" className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2">
                      <span>Current Release Space</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "new-ticket" ? (
            <div className="card shadow-lg p-4 p-md-5" style={{ width: "100%", borderRadius: "20px" }}>
              <h1 className="mb-4 fw-bold text-primary text-center">Ticket Status</h1>
              <div className="mb-4">
                <label htmlFor="new-ticket-id" className="form-label fw-semibold">Enter Ticket ID</label>
                <div className="input-group">
                  <input
                    id="new-ticket-id"
                    type="text"
                    className="form-control"
                    placeholder="Enter Ticket ID"
                    value={newTicketId}
                    onChange={(e) => setNewTicketId(e.target.value)}
                  />
                  <button
                    className="btn btn-primary d-flex align-items-center justify-content-center"
                    onClick={handleNewTicketSubmit}
                    disabled={newTicketLoading}
                  >
                    {newTicketLoading ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    ) : null}
                    {newTicketLoading ? "Checking..." : "Check Status"}
                  </button>
                </div>
                {newTicketError && <div className="text-danger mt-2 small">{newTicketError}</div>}
              </div>

              {!!newTicketResult && (
                <div className="mt-5">
                  <div className="d-flex align-items-center gap-2 mb-4">
                    <div className="bg-primary text-white p-2 rounded-3">
                      {"\u2705"}
                    </div>
                    <h2 className="h5 fw-bold mb-0">Ticket Status Result</h2>
                  </div>
                  {renderNewTicketResult(newTicketResult)}
                </div>
              )}
            </div>
          ) : activeTab === "bug-reported-so-far" ? (
            <div
              className="card shadow-lg p-5 text-center mx-auto"
              style={{ maxWidth: "520px", width: "100%", borderRadius: "20px" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Bug Reported So Far</h1>
              <p className="text-muted mb-0">This section is coming soon.</p>
            </div>
          ) : activeTab === "watch-how-it-works-bug-classifier" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Watch How It Works</h1>
              <div style={videoContainerStyle}>
                <iframe
                  src="https://drive.google.com/file/d/1fOt4JOMdhNIUNgG3x1xy0mSFcVPO9h0Y/preview"
                  allowFullScreen
                  style={videoIframeStyle}
                  title="Bug classifier walkthrough"
                />
              </div>
            </div>
          ) : activeTab === "watch-how-it-works-sprint" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Watch How It Works</h1>
              <div style={videoContainerStyle}>
                <iframe
                  src="https://drive.google.com/file/d/1U82YUdK5EhsV6vt7hVmdcKbBjGjVtqfH/preview"
                  allow="autoplay"
                  allowFullScreen
                  style={videoIframeStyle}
                  title="Sprint workflow walkthrough"
                />
              </div>
            </div>
          ) : activeTab === "add-ticket-to-sprint" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">Add Ticket To Sprint</h1>

              <div className="card border shadow-sm">
                <div className="card-body p-4 p-md-5">
                  <div className="d-grid gap-3">
                    <div className="border rounded-3 bg-light p-3">
                      <div className="d-flex align-items-start gap-3">
                        <span
                          className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold"
                          style={{ width: "32px", height: "32px" }}
                        >
                          1
                        </span>
                        <div>
                          <h2 className="h5 fw-bold mb-2">Step 1 - Open the Sprint Sheet</h2>
                          <p className="mb-0">
                            Access the sprint sheet here:{" "}
                            <a
                              href="https://docs.google.com/spreadsheets/d/1ZnlKpU3Bqqaxm4G7eHKc4zvO4VzQIjxxaXzDAEAFw7I/edit?gid=0#gid=0"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-primary text-decoration-underline"
                            >
                              {"\uD83D\uDD17"} Sprint Sheet
                            </a>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light p-3">
                      <div className="d-flex align-items-start gap-3">
                        <span
                          className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold"
                          style={{ width: "32px", height: "32px" }}
                        >
                          2
                        </span>
                        <div>
                          <h2 className="h5 fw-bold mb-2">Step 2 - Enter the Ticket ID</h2>
                          <p className="mb-0">
                            Enter the ticket ID in the designated column. All information
                            corresponding to that ticket, including its details and metadata, will
                            automatically populate across the subsequent columns in the same row.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light p-3">
                      <div className="d-flex align-items-start gap-3">
                        <span
                          className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold"
                          style={{ width: "32px", height: "32px" }}
                        >
                          3
                        </span>
                        <div>
                          <h2 className="h5 fw-bold mb-2">Step 3 - Automatic Scoring</h2>
                          <p className="mb-0">
                            Once the ticket ID is entered, the ticket is also automatically scored.
                            Detailed scoring information is computed and filled into the sheet
                            without any manual input required.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-3 bg-light p-3">
                      <div className="d-flex align-items-start gap-3">
                        <span
                          className="rounded-circle bg-secondary text-white d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold"
                          style={{ width: "32px", height: "32px" }}
                        >
                          +
                        </span>
                        <div>
                          <h2 className="h5 fw-bold mb-2">Bonus - Refresh for Latest Data</h2>
                          <p className="mb-0">
                            To get the most up-to-date information for any ticket already in the
                            sheet, click the refresh button located next to the ticket ID. This will
                            re-fetch and overwrite the row with the latest content from the source.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "play-store-release-automation" ? (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">
                Play Store Release Automation
              </h1>

              <div className="d-grid gap-4">
                <div className="card border shadow-sm">
                  <div className="card-body p-4 p-md-5">
                    <h2 className="h5 fw-bold mb-3" style={{ color: "#4f46e5" }}>
                      What is this?
                    </h2>
                    <p className="mb-0">
                      The Android Build Automation suite lets you trigger GitLab CI/CD
                      pipelines directly from your browser - no terminal, no manual steps.
                      From updating the version code to publishing a release on the Play
                      Store, everything is automated and trackable in one place.
                    </p>
                  </div>
                </div>

                <div className="card border shadow-sm">
                  <div className="card-body p-4 p-md-5">
                    <h2 className="h5 fw-bold mb-3" style={{ color: "#4f46e5" }}>
                      What can this automation do?
                    </h2>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDD22"}</span>
                            <div>
                              <div className="fw-semibold">Change Version Code</div>
                              <small className="text-muted">
                                Update the app version code without a manual commit
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDCE6"}</span>
                            <div>
                              <div className="fw-semibold">Create the Build (APK)</div>
                              <small className="text-muted">
                                Generate a release APK ready for distribution
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDD25"}</span>
                            <div>
                              <div className="fw-semibold">Create Build &amp; Upload to Firebase</div>
                              <small className="text-muted">
                                Build APK and instantly distribute via Firebase App Distribution
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDCF1"}</span>
                            <div>
                              <div className="fw-semibold">Create Bundle (AAB)</div>
                              <small className="text-muted">
                                Generate an Android App Bundle for Play Store submission
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDE80"}</span>
                            <div>
                              <div className="fw-semibold">
                                Create Bundle &amp; Upload to Play Store (Internal)
                              </div>
                              <small className="text-muted">
                                Build AAB and push directly to the internal testing track
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 h-100 border" style={{ background: "#f8f9fc", borderColor: "#e2e8f0" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83E\uDDEA"}</span>
                            <div>
                              <div className="fw-semibold">
                                Create Bundle &amp; Upload to Play Store (Beta)
                              </div>
                              <small className="text-muted">
                                Build AAB and push directly to the beta testing track
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border shadow-sm">
                  <div className="card-body p-4 p-md-5">
                    <h2 className="h5 fw-bold mb-3" style={{ color: "#4f46e5" }}>
                      Who can use this?
                    </h2>
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <div className="rounded-4 h-100 p-4" style={{ background: "#eef2ff" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDC68\u200D\uD83D\uDCBB"}</span>
                            <div>
                              <div className="fw-semibold mb-2">Developers</div>
                              <p className="mb-0 text-muted">
                                Trigger builds at any stage of development - test APKs on
                                Firebase, validate bundles, or bump the version code before a
                                release without leaving your browser.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="rounded-4 h-100 p-4" style={{ background: "#f5f3ff" }}>
                          <div className="d-flex align-items-start gap-3">
                            <span style={{ fontSize: 28 }}>{"\uD83D\uDE80"}</span>
                            <div>
                              <div className="fw-semibold mb-2">Release Managers</div>
                              <p className="mb-0 text-muted">
                                Manage the full release pipeline end to end - from internal
                                testing to beta rollout on the Play Store - with full visibility
                                into pipeline status and one-click triggers.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border shadow-sm mx-auto" style={{ maxWidth: "820px" }}>
                  <div className="card-body p-4 p-md-5 text-center">
                    <p className="mb-4 text-muted">
                      Ready to get started? The full Build Automation Dashboard is available on
                      the dedicated page.
                    </p>

                    <button
                      type="button"
                      className="btn btn-lg text-white fw-semibold px-5"
                      style={{
                        background: "linear-gradient(135deg, #667eea, #764ba2)",
                        border: "none",
                        borderRadius: "10px",
                      }}
                      onClick={() => router.push("/build_automation")}
                    >
                      Take Me There
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="card shadow-lg p-4 p-md-5"
              style={{ width: "100%", borderRadius: "20px", minHeight: "100%" }}
            >
              <h1 className="mb-4 fw-bold text-primary text-center">IndiaMART Bug Guidelines</h1>

              <section className="mb-4 pb-4 border-bottom border-light-subtle">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <span className="badge bg-danger fs-6">High Priority Bugs</span>
                  <span className="fw-semibold">TAT 72 hours (Weekends included)</span>
                </div>
                <p className="mb-3">
                  Triggered when feature usage or impacted data is more than 2%, or the issue
                  occurs on pages/platforms with traffic more than 2%.
                </p>
                <p className="fw-semibold mb-2">Key categories and examples:</p>
                <ul className="mb-3 ps-4 lh-lg">
                  <li>
                    <strong>Impacting SEO:</strong> Server errors, internal 404s, incorrect
                    redirections, metadata mistakes, page speed drops
                  </li>
                  <li>
                    <strong>Impacting Conversions:</strong> Requirements not getting posted, users
                    not getting verified, CTAs not working
                  </li>
                  <li>
                    <strong>Feature Functionality Major Break:</strong> Login failures, seller
                    unable to update product data, data not saving or saving incorrectly, console
                    errors that break functionality
                  </li>
                  <li>
                    <strong>Financial Loss:</strong> Unable to purchase BL or BL package, BLs not
                    getting approved
                  </li>
                  <li>
                    <strong>Denting Brand Goodwill:</strong> Banned keywords getting approved, IM
                    logo distorted
                  </li>
                  <li>
                    <strong>Security Issues:</strong> User confidential data breached, BL credits
                    misused, server/DB credentials compromised
                  </li>
                  <li>
                    <strong>App Crashes:</strong> Crashes on positive scenarios such as adding a
                    product, posting a requirement, or sending an enquiry
                  </li>
                  <li>
                    <strong>Communications:</strong> Mass delivery failures, incorrect content in
                    emails/SMS/notifications, incorrect redirections
                  </li>
                  <li>
                    <strong>Denting User Experience Drastically:</strong> Major UI distortions
                  </li>
                  <li>
                    <strong>Content Bugs:</strong> Banned keywords or content in descriptions, PDFs,
                    videos, images
                  </li>
                  <li>
                    <strong>Search - Irrelevant Results (impact more than 2%):</strong> Grossly
                    irrelevant search results, rejected products appearing in search
                  </li>
                  <li>
                    <strong>Search - Irrelevant Related MCAT:</strong> All irrelevant MCAT showing
                    when matching ones exist
                  </li>
                  <li>
                    <strong>Search - Incorrect Sequencing:</strong> High confidence MCAT appearing
                    below low confidence ones
                  </li>
                </ul>
                <p className="mb-0 text-muted fst-italic">
                  Note: Only volume of impact is discussed, not modes or type of user.
                </p>
              </section>

              <section className="mb-4 pb-4 border-bottom border-light-subtle">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <span className="badge bg-warning text-dark fs-6">Medium Priority Bugs</span>
                  <span className="fw-semibold">TAT 7 days (Weekends excluded)</span>
                </div>
                <p className="mb-3">
                  All major issues from High Priority categories occurring on pages/platforms with
                  traffic less than 2% fall under Medium priority.
                </p>
                <p className="fw-semibold mb-2">Key categories and examples:</p>
                <ul className="mb-0 ps-4 lh-lg">
                  <li>
                    <strong>Functional Bugs:</strong> Irrelevant suppliers in ASTbuy, incorrect
                    MCAT listing, app crashes on low/fluctuating network, unusual test steps causing
                    critical issues
                  </li>
                  <li>
                    <strong>Content Bugs:</strong> Incorrect banner of paid supplier, incorrect data
                    on frontend, duplicate ISQs, incorrect FAQs, incorrect BL or company content
                  </li>
                  <li>
                    <strong>Search - Irrelevant Results (impact less than 2%):</strong> Verified
                    via GA data and Google Trends
                  </li>
                  <li>
                    <strong>Seller Not Coming in Listing:</strong> Relevant seller not appearing in
                    search but present in MCAT listing
                  </li>
                  <li>
                    <strong>Incorrect Ordering:</strong> Paid seller appearing at lower position
                  </li>
                </ul>
              </section>

              <section className="mb-4 pb-4 border-bottom border-light-subtle">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <span className="badge bg-secondary fs-6">Low Priority Bugs</span>
                  <span className="fw-semibold">TAT 15 days (Weekends excluded)</span>
                </div>
                <p className="mb-3">
                  Everything not mentioned in High or Medium categories falls here.
                </p>
                <p className="fw-semibold mb-2">Key categories and examples:</p>
                <ul className="mb-0 ps-4 lh-lg">
                  <li>
                    <strong>Minor UI Distortions:</strong> Alignment issues, CTA size/color
                    mismatches, font mismatches, elements overlapping
                  </li>
                  <li>
                    <strong>Content Issues:</strong> Truncated data, incorrect price/PDF/name/image/
                    video, junk characters, incorrect validation messages
                  </li>
                  <li>
                    <strong>Bulk Data Correction:</strong> Functional flaw fixed under High Priority
                    but impacted data cleanup handled as Low Priority
                  </li>
                </ul>
              </section>

              <div className="alert alert-warning mb-4">
                <strong>Important Note:</strong> Bugs should not be rejected without the author&apos;s
                consent.
              </div>

              <p className="mb-0">
                For the complete official guidelines,{" "}
                <a
                  href="https://drive.google.com/file/d/1qk0kxzhfGjneQFjjmFqwS6P8QwMwbn5e/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-primary text-decoration-underline"
                >
                  click here
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
