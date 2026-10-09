import * as cheerio from "cheerio";

export type AIAddress = {
  organizationName: string | null;
  fullAddress: string;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  postalCode: string | null;
  source: string;
  confidence: "High" | "Medium" | "Low";
  isPrimary: boolean;
};

export type AIAddressResult = {
  addressFound: boolean;
  locations: AIAddress[];
};

function preparePage(html: string): string {
  const $ = cheerio.load(html);

  // Remove unnecessary page content
  $("script:not([type='application/ld+json']), style, noscript, svg").remove();

  const structuredData: string[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const text = $(element).text().trim();

    if (text) {
      structuredData.push(text);
    }
  });

  const addressElements: string[] = [];

  $("address").each((_, element) => {
    const text = $(element)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      addressElements.push(text);
    }
  });

  const usefulSections: string[] = [];

  $(
    `
      footer,
      [class*="contact"],
      [class*="location"],
      [class*="address"],
      [class*="office"],
      [class*="headquarter"],
      [id*="contact"],
      [id*="location"],
      [id*="address"],
      [id*="office"]
    `
  ).each((_, element) => {
    const text = $(element)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text && text.length > 20) {
      usefulSections.push(text);
    }
  });

  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return `
STRUCTURED DATA:
${structuredData.join("\n")}

ADDRESS ELEMENTS:
${addressElements.join("\n")}

CONTACT / LOCATION SECTIONS:
${usefulSections.join("\n")}

PAGE TEXT:
${bodyText}
`.slice(0, 50000);
}

export async function extractAddressesWithAI(
  pages: { url: string; html: string }[]
): Promise<AIAddressResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing in .env.local"
    );
  }

  const allLocations: AIAddress[] = [];

  for (const page of pages) {
    const content = preparePage(page.html);

    const prompt = `
You are a strict physical-address extraction system.

Analyze the website content below.

Your task is to identify REAL PHYSICAL LOCATIONS belonging to the organization or business represented by this website.

IMPORTANT RULES:

1. Only return actual physical street or postal addresses.
2. Do NOT treat normal sentences as addresses.
3. Do NOT treat certifications as addresses.
4. Do NOT treat company descriptions as addresses.
5. Do NOT treat marketing text as addresses.
6. Do NOT treat product names as addresses.
7. Do NOT treat job descriptions as addresses.
8. Do NOT invent missing information.
9. Do NOT guess the city, state, country, or postal code.
10. Use only information actually present in the website content.
11. If multiple physical offices or locations exist, return all reliable locations.
12. Mark isPrimary=true only when the website explicitly indicates that location as:
    - headquarters
    - head office
    - main office
    - corporate office
    - registered office
    - primary location
13. If no reliable physical address exists, return addressFound=false.
14. Do not assume the organization is located in any particular country.
15. A real physical address normally contains meaningful location information such as:
    building, house number, street, locality, city, region, country, postal code, etc.
16. Never return a sentence, slogan, certification, or marketing phrase as an address.

Return ONLY valid JSON.

Use exactly this format:

{
  "addressFound": true,
  "locations": [
    {
      "organizationName": "string or null",
      "fullAddress": "complete physical address",
      "city": "string or null",
      "stateProvince": "string or null",
      "country": "string or null",
      "postalCode": "string or null",
      "source": "where the address was found",
      "confidence": "High",
      "isPrimary": true
    }
  ]
}

If there is no reliable physical address:

{
  "addressFound": false,
  "locations": []
}

Confidence rules:

High:
The address is clearly shown as a physical location in structured data, an address element, contact/location section, footer, or clearly identified office information.

Medium:
The address appears to be a physical address but some information is incomplete.

Low:
The information may relate to a physical location but is not sufficiently reliable.

Website URL:
${page.url}

Website content:
${content}
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Gemini API failed: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();

      const generatedText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        console.warn(
          `Gemini returned no content for ${page.url}`
        );
        continue;
      }

      let parsed: AIAddressResult;

      try {
        parsed = JSON.parse(generatedText);
      } catch (error) {
        console.error(
          "Gemini returned invalid JSON:",
          generatedText,
          error
        );
        continue;
      }

      if (
        parsed.addressFound === true &&
        Array.isArray(parsed.locations)
      ) {
        for (const location of parsed.locations) {
          if (
            location &&
            typeof location.fullAddress === "string" &&
            location.fullAddress.trim().length > 0
          ) {
            allLocations.push({
              organizationName:
                location.organizationName ?? null,

              fullAddress:
                location.fullAddress.trim(),

              city:
                location.city ?? null,

              stateProvince:
                location.stateProvince ?? null,

              country:
                location.country ?? null,

              postalCode:
                location.postalCode ?? null,

              source:
                location.source || "Website",

              confidence:
                location.confidence === "High" ||
                location.confidence === "Medium" ||
                location.confidence === "Low"
                  ? location.confidence
                  : "Low",

              isPrimary:
                location.isPrimary === true,
            });
          }
        }
      }
    } catch (error) {
      console.error(
        `Gemini request failed for ${page.url}:`,
        error
      );
    }
  }

  // Remove duplicate addresses
  const uniqueLocations = allLocations.filter(
    (location, index, array) =>
      index ===
      array.findIndex(
        (item) =>
          item.fullAddress.toLowerCase() ===
          location.fullAddress.toLowerCase()
      )
  );

  if (uniqueLocations.length === 0) {
    return {
      addressFound: false,
      locations: [],
    };
  }

  // If no location was explicitly marked primary,
  // make the first reliable location primary.
  const hasPrimary = uniqueLocations.some(
    (location) => location.isPrimary
  );

  if (!hasPrimary) {
    uniqueLocations[0].isPrimary = true;
  }

  return {
    addressFound: true,
    locations: uniqueLocations,
  };
}