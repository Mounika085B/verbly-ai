export type GrammarSeverity = "error" | "warning" | "info" | null;

export interface GrammarFinding {
  message: string;
  short_message: string | null;
  category: string;
  rule_id: string;
  issue_type: string;
  severity: GrammarSeverity;
  offset: number;
  length: number;
  context: string | null;
  replacements: string[];
}

export interface GrammarAnalysisResult {
  text_length: number;
  finding_count: number;
  findings: GrammarFinding[];
  issues: GrammarFinding[];
}