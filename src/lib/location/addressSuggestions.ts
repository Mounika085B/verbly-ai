import type {
  AIWebsiteAnalysis,
} from "@/lib/location/aiWebsiteAnalysis";

export interface WebsiteSuggestion {
  name: string;
  reason: string;
}

export interface AddressSuggestionResult {
  websiteType: string;
  reason: string;
  suggestions: WebsiteSuggestion[];
  confidence: "High" | "Medium" | "Low";
}

/*
 * Convert the AI analysis into UI-friendly suggestions.
 *
 * No company names are stored here.
 */
export function createAddressSuggestions(
  analysis: AIWebsiteAnalysis
): AddressSuggestionResult {
  const suggestions =
    analysis.suggestedWebsiteTypes
      .map(
        (
          type
        ): WebsiteSuggestion => ({
          name: type,
          reason:
            `This website type is related to the analyzed website type: ${analysis.websiteType}.`,
        })
      );

  return {
    websiteType:
      analysis.websiteType,

    reason:
      analysis.reason,

    suggestions,

    confidence:
      analysis.confidence,
  };
}