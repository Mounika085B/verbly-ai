import { NextResponse } from "next/server";
import { analyzeGrammar } from "@/services/grammarService";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body.text !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Text is required.",
        },
        { status: 400 },
      );
    }

    const text = body.text;

    if (!text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Text cannot be empty.",
        },
        { status: 400 },
      );
    }

    if (text.length > 20000) {
      return NextResponse.json(
        {
          success: false,
          error: "Text cannot exceed 20,000 characters.",
        },
        { status: 400 },
      );
    }

    const result = await analyzeGrammar(text);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Grammar API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Grammar analysis failed.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}