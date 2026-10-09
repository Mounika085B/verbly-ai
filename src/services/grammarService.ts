import type {
  GrammarAnalysisResult,
  GrammarFinding,
  GrammarSeverity,
} from "@/types/grammer";

const LANGUAGE_TOOL_URL = (
  process.env.LANGUAGETOOL_URL || "http://localhost:8010"
).replace(/\/+$/, "");

const MAX_REPLACEMENTS = 5;

interface LanguageToolMatch {
  message?: unknown;
  shortMessage?: unknown;
  offset?: unknown;
  length?: unknown;
  replacements?: unknown;

  rule?: {
    id?: unknown;
    issueType?: unknown;

    category?: {
      id?: unknown;
      name?: unknown;
    };
  };

  context?: {
    text?: unknown;
  };
}

interface LanguageToolResponse {
  matches?: unknown;
}

function getSeverity(issueType: string): GrammarSeverity {
  switch (issueType) {
    case "misspelling":
    case "typographical":
      return "error";

    case "grammar":
    case "punctuation":
    case "casing":
    case "confused_words":
    case "duplication":
      return "warning";

    case "style":
    case "register":
    case "redundancy":
    case "inconsistency":
    case "whitespace":
    case "semantics":
    case "non-conformance":
      return "info";

    default:
      return null;
  }
}

function mapFinding(
  match: LanguageToolMatch,
): GrammarFinding | null {
  if (
    typeof match.message !== "string" ||
    typeof match.offset !== "number" ||
    typeof match.length !== "number"
  ) {
    return null;
  }

  const ruleId =
    typeof match.rule?.id === "string"
      ? match.rule.id
      : "UNKNOWN";

  const issueType =
    typeof match.rule?.issueType === "string"
      ? match.rule.issueType
      : "unknown";

  const category =
    typeof match.rule?.category?.name === "string"
      ? match.rule.category.name
      : typeof match.rule?.category?.id === "string"
        ? match.rule.category.id
        : "unknown";

  const replacements = Array.isArray(match.replacements)
    ? match.replacements
        .filter(
          (
            replacement,
          ): replacement is { value?: unknown } =>
            typeof replacement === "object" &&
            replacement !== null &&
            "value" in replacement,
        )
        .map((replacement) => replacement.value)
        .filter(
          (value): value is string =>
            typeof value === "string",
        )
        .slice(0, MAX_REPLACEMENTS)
    : [];

  const context =
    typeof match.context?.text === "string"
      ? match.context.text
      : null;

  return {
    message: match.message,

    short_message:
      typeof match.shortMessage === "string"
        ? match.shortMessage
        : null,

    category,

    rule_id: ruleId,

    issue_type: issueType,

    severity: getSeverity(issueType),

    offset: match.offset,

    length: match.length,

    context,

    replacements,
  };
}

function removeDuplicates(
  findings: GrammarFinding[],
): GrammarFinding[] {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = JSON.stringify([
      finding.offset,
      finding.length,
      finding.rule_id,
      finding.message,
    ]);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

export async function analyzeGrammar(
  text: string,
): Promise<GrammarAnalysisResult> {
  if (!text || !text.trim()) {
    throw new Error("Text cannot be empty.");
  }

  if (text.length > 20000) {
    throw new Error(
      "Text cannot exceed 20,000 characters.",
    );
  }

  const formData = new URLSearchParams();

  formData.append("text", text);
  formData.append("language", "en-US");

  const endpoint = `${LANGUAGE_TOOL_URL}/v2/check`;

  console.log(
    "Grammar engine endpoint:",
    endpoint,
  );

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: formData.toString(),

      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error(
      "LanguageTool connection error:",
      error,
    );

    throw new Error(
      "Grammar engine is unavailable. Make sure LanguageTool is running.",
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    console.error(
      "LanguageTool HTTP error:",
      response.status,
      errorText,
    );

    throw new Error(
      `Grammar engine returned HTTP ${response.status}.`,
    );
  }

  let data: LanguageToolResponse;

  try {
    data =
      (await response.json()) as LanguageToolResponse;
  } catch (error) {
    console.error(
      "LanguageTool JSON error:",
      error,
    );

    throw new Error(
      "Grammar engine returned invalid JSON.",
    );
  }

  if (!Array.isArray(data.matches)) {
    throw new Error(
      "Grammar engine returned an invalid response.",
    );
  }

  const findings = data.matches
    .filter(
      (match): match is LanguageToolMatch =>
        typeof match === "object" &&
        match !== null,
    )
    .map(mapFinding)
    .filter(
      (finding): finding is GrammarFinding =>
        finding !== null,
    );

  const uniqueFindings =
    removeDuplicates(findings);

  uniqueFindings.sort((a, b) => {
    if (a.offset !== b.offset) {
      return a.offset - b.offset;
    }

    if (a.length !== b.length) {
      return a.length - b.length;
    }

    return a.rule_id.localeCompare(b.rule_id);
  });

  return {
    text_length: text.length,

    finding_count: uniqueFindings.length,

    findings: uniqueFindings,

    issues: uniqueFindings,
  };
}