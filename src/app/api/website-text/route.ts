import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Read request body
    const body = await request.json();

    const url = body?.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Website URL is required.",
        },
        { status: 400 },
      );
    }

    // 2. Prepare URL
    let websiteUrl = url.trim();

    if (
      !websiteUrl.startsWith("http://") &&
      !websiteUrl.startsWith("https://")
    ) {
      websiteUrl = `https://${websiteUrl}`;
    }

    // 3. Validate URL
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid website URL.",
        },
        { status: 400 },
      );
    }

    // 4. Fetch website
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let response: Response;

    try {
      response = await fetch(websiteUrl, {
        method: "GET",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; VerblyAI/1.0)",
          Accept:
            "text/html,application/xhtml+xml",
        },

        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // 5. Check response
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Website returned HTTP ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes(
        "application/xhtml+xml",
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The provided URL did not return an HTML webpage.",
        },
        { status: 422 },
      );
    }

    // 6. Read HTML
    const html = await response.text();

    if (!html.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The website returned empty content.",
        },
        { status: 422 },
      );
    }

    // 7. Load HTML with Cheerio
    const $ = cheerio.load(html);

    // Remove elements that should not be
    // checked for grammar.
    $(
      "script, style, noscript, iframe, svg, canvas, template, nav, footer, form",
    ).remove();

    // 8. Extract main content
    let text = "";

    const mainSelectors = [
      "main",
      "article",
      "[role='main']",
      ".content",
      "#content",
    ];

    for (const selector of mainSelectors) {
      // IMPORTANT:
      // .text() returns a STRING.
      const candidate = $(selector).text();

      if (
        candidate.trim().length >
        text.trim().length
      ) {
        text = candidate;
      }
    }

    // 9. Fallback to body
    if (text.trim().length < 100) {
      // IMPORTANT:
      // Do NOT use .text(" ")
      text = $("body").text();
    }

    // 10. Clean whitespace
    text = text
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();

    // 11. Limit text sent to Grammar API
    text = text.slice(0, 20000);

    // 12. Check extracted text
    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No readable text could be extracted from the website.",
        },
        { status: 422 },
      );
    }

    console.log(
      "Website text extracted successfully:",
      {
        url: websiteUrl,
        characters: text.length,
      },
    );

    // 13. Return JSON
    return NextResponse.json({
      success: true,
      url: websiteUrl,
      text,
    });
  } catch (error) {
    console.error(
      "Website Text API error:",
      error,
    );

    // Timeout
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The website took too long to respond.",
        },
        { status: 504 },
      );
    }

    // General error
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract website text.",
      },
      { status: 500 },
    );
  }
}