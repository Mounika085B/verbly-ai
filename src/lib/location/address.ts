import * as cheerio from "cheerio";

export type ExtractedLocation = {
  organizationName: string | null;

  fullAddress: string;

  streetAddress: string | null;

  locality: string | null;

  city: string | null;

  stateProvince: string | null;

  country: string | null;

  postalCode: string | null;

  source: string;

  confidence: "High" | "Medium" | "Low";

  isPrimary: boolean;
};


/* ============================================================
   TEXT CLEANING
============================================================ */

function cleanText(
  value: string | undefined | null
): string {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/* ============================================================
   ADDRESS CLEANING
============================================================ */

function cleanAddressText(
  text: string
): string {
  let value = cleanText(text);

  /* Remove email addresses */
  value = value.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    ""
  );

  /* Remove phone numbers */
  value = value.replace(
    /(?:\+?\d[\d\s().-]{7,}\d)/g,
    ""
  );

  /* Remove common contact labels */
  value = value.replace(
    /\b(?:contact|phone|telephone|tel|fax|email|admissions?|enquiry|inquiries?|hostel|helpline)\s*:?\s*/gi,
    ""
  );

  return value
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();
}


/* ============================================================
   CHECK WHETHER TEXT LOOKS LIKE AN ADDRESS
============================================================ */

function isPossibleAddress(
  text: string
): boolean {
  const value =
    cleanText(text);

  if (value.length < 10) {
    return false;
  }

  if (value.length > 300) {
    return false;
  }

  /*
   * Split the text into possible address components.
   *
   * IMPORTANT:
   * Validate individual components instead of looking for
   * address words anywhere inside a paragraph.
   */
  const parts =
    value
      .split(/[,|\n]+/)
      .map((part) =>
        cleanText(part)
      )
      .filter(Boolean);

  const hasMultipleParts =
    parts.length >= 2;

  /*
   * POSTAL CODE
   */
  const postalCode =
    extractPostalCode(value);

  const hasPostalCode =
    Boolean(postalCode);

  /*
   * STREET / ROAD
   *
   * Check individual components only.
   * Do not check the entire sentence.
   */
  const hasStreet =
    parts.some((part) =>
      isStreetLike(part)
    );

  /*
   * ADDRESS NUMBER
   *
   * A year such as 2025 is NOT enough.
   *
   * Examples:
   * 1600 Amphitheatre Parkway
   * 221B Baker Street
   * 12 MG Road
   */
  const hasAddressNumber =
    parts.some((part) =>
      /^\d{1,6}[A-Za-z]?\s+[A-Za-z]/.test(
        part
      )
    );

  /*
   * BUILDING / PROPERTY COMPONENT
   */
  const hasBuildingComponent =
    parts.some((part) =>
      /^\s*(?:building|block|unit|suite|floor|plot|sector|phase|tower|house|flat|apartment|apt)\s*[:#-]?\s*\S+/i.test(
        part
      )
    );

  /*
   * EXPLICIT ADDRESS LABEL
   *
   * "Address: 12 MG Road" can qualify.
   * A normal sentence containing the word "address" cannot.
   */
  const hasExplicitAddressLabel =
    /^\s*(?:address|street address)\s*[:#-]/i.test(
      value
    );

  const hasAddressSeparator =
    /[,|]/.test(value);

  /*
   * Long natural-language paragraphs without strong
   * address structure are rejected.
   */
  const wordCount =
    value
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const sentenceLike =
    wordCount > 15 &&
    !hasPostalCode &&
    !hasAddressNumber &&
    !hasBuildingComponent &&
    !hasExplicitAddressLabel;

  if (sentenceLike) {
    return false;
  }

  /*
   * STRONG CASE 1:
   * Postal code + street.
   */
  if (
    hasPostalCode &&
    hasStreet
  ) {
    return true;
  }

  /*
   * STRONG CASE 2:
   * Postal code + multiple address components.
   */
  if (
    hasPostalCode &&
    hasMultipleParts &&
    hasAddressSeparator
  ) {
    return true;
  }

  /*
   * STRONG CASE 3:
   * Street number + street.
   */
  if (
    hasAddressNumber &&
    hasStreet
  ) {
    return true;
  }

  /*
   * STRONG CASE 4:
   * Building/property component + multiple components.
   */
  if (
    hasBuildingComponent &&
    hasMultipleParts &&
    hasAddressSeparator
  ) {
    return true;
  }

  /*
   * STRONG CASE 5:
   * Explicit address label + another strong component.
   */
  if (
    hasExplicitAddressLabel &&
    (
      hasStreet ||
      hasPostalCode ||
      hasAddressNumber ||
      hasBuildingComponent
    )
  ) {
    return true;
  }

  /*
   * Otherwise do not guess.
   */
  return false;
}


/* ============================================================
   ORGANIZATION NAME
============================================================ */

function getOrganizationName(
  $: cheerio.CheerioAPI
): string | null {

  const candidates = [
    $(
      'meta[property="og:site_name"]'
    ).attr("content"),

    $(
      'meta[name="application-name"]'
    ).attr("content"),

    $(
      'meta[property="og:title"]'
    ).attr("content"),

    $("title")
      .first()
      .text(),

    $("h1")
      .first()
      .text(),
  ];

  for (
    const candidate of candidates
  ) {
    const value =
      cleanText(candidate);

    if (
      value.length >= 2 &&
      value.length <= 150
    ) {
      return value;
    }
  }

  return null;
}


/* ============================================================
   NORMALIZE VALUE FOR COMPARISON
============================================================ */

function normalizeValue(
  value: string
): string {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " "
    )
    .trim();
}


/* ============================================================
   POSTAL CODE EXTRACTION
============================================================ */

function extractPostalCode(
  cleaned: string
): string | null {

  /*
   * ----------------------------------------------------------
   * 1. Explicit postal labels
   *
   * PIN: 560119
   * PIN Code: 560119
   * Postal Code: 560119
   * Postcode: ...
   * ZIP: ...
   * ----------------------------------------------------------
   */

  const explicitPostalMatch =
    cleaned.match(
      /\b(?:pin|pincode|pin\s*code|postal\s*code|postcode|zip\s*code|zip)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s-]{2,9})\b/i
    );

  if (
    explicitPostalMatch?.[1]
  ) {
    return explicitPostalMatch[1]
      .trim()
      .replace(/[.,;]+$/, "");
  }


  /*
   * ----------------------------------------------------------
   * 2. Indian PIN
   *
   * EXACTLY six digits.
   *
   * 560119 -> valid
   * 560066 -> valid
   * 158 -> NOT valid
   * 14 -> NOT valid
   * ----------------------------------------------------------
   */

  const indianPinMatch =
    cleaned.match(
      /\b\d{6}\b/
    );

  if (
    indianPinMatch?.[0]
  ) {
    return indianPinMatch[0];
  }


  /*
   * ----------------------------------------------------------
   * 3. UK postal code
   * ----------------------------------------------------------
   */

  const ukPostalMatch =
    cleaned.match(
      /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i
    );

  if (
    ukPostalMatch?.[0]
  ) {
    return ukPostalMatch[0]
      .trim()
      .toUpperCase();
  }


  /*
   * ----------------------------------------------------------
   * 4. Canadian postal code
   * ----------------------------------------------------------
   */

  const canadianPostalMatch =
    cleaned.match(
      /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i
    );

  if (
    canadianPostalMatch?.[0]
  ) {
    return canadianPostalMatch[0]
      .trim()
      .toUpperCase();
  }


  /*
   * ----------------------------------------------------------
   * 5. US ZIP
   * ----------------------------------------------------------
   */

  const usZipMatch =
    cleaned.match(
      /\b\d{5}(?:-\d{4})?\b/
    );

  if (
    usZipMatch?.[0]
  ) {
    return usZipMatch[0];
  }

  return null;
}


/* ============================================================
   STREET / ROAD DETECTION
============================================================ */

function isStreetLike(
  value: string
): boolean {

  const text =
    normalizeValue(value);

  /*
   * Examples:
   *
   * Doddaballapur Main Road
   * MG Road
   * Main Street
   * 5th Avenue
   * Airport Road
   * Ring Road
   * Yelahanka Road
   */

  return /\b(?:road|rd|street|st|lane|ln|avenue|ave|drive|dr|highway|hwy|boulevard|blvd|main road|cross road)\b/i.test(
    text
  );
}


/* ============================================================
   PARSE ADDRESS
============================================================ */

function parseAddress(
  address: string,
  organizationName: string | null
): {
  streetAddress: string | null;

  locality: string | null;

  city: string | null;

  stateProvince: string | null;

  country: string | null;

  postalCode: string | null;
} {

  const cleaned =
    cleanText(address);


  /* ----------------------------------------------------------
     POSTAL CODE
  ---------------------------------------------------------- */

  const postalCode =
    extractPostalCode(
      cleaned
    );


  /* ----------------------------------------------------------
     SPLIT ADDRESS
  ---------------------------------------------------------- */

  let parts =
    cleaned
      .split(/[,|\n]+/)
      .map((part) =>
        cleanText(part)
      )
      .filter(Boolean);


  /* ----------------------------------------------------------
     REMOVE POSTAL CODE FROM PARTS
  ---------------------------------------------------------- */

  if (postalCode) {

    const normalizedPostal =
      normalizeValue(
        postalCode
      );

    parts =
      parts
        .map((part) => {

          const normalizedPart =
            normalizeValue(
              part
            );

          /*
           * If the entire part is just the
           * postal code, remove it.
           */

          if (
            normalizedPart ===
            normalizedPostal
          ) {
            return "";
          }

          /*
           * Otherwise remove the postal code
           * from the part.
           */

          return cleanText(
            part.replace(
              new RegExp(
                postalCode.replace(
                  /[-/\\^$*+?.()|[\]{}]/g,
                  "\\$&"
                ),
                "gi"
              ),
              ""
            )
          );
        })
        .filter(Boolean);
  }


  /* ----------------------------------------------------------
     REMOVE ORGANIZATION NAME
     ---------------------------------------------------------- */

  if (
    organizationName &&
    parts.length > 0
  ) {

    const organization =
      normalizeValue(
        organizationName
      );

    const firstPart =
      normalizeValue(
        parts[0]
      );

    /*
     * Remove only if the first address
     * component really matches the organization.
     */

    if (
      firstPart === organization ||
      firstPart.includes(
        organization
      ) ||
      organization.includes(
        firstPart
      )
    ) {
      parts =
        parts.slice(1);
    }
  }


  /* ----------------------------------------------------------
     CLEAN PARTS
     ---------------------------------------------------------- */

  parts =
    parts
      .map((part) =>
        cleanText(part)
      )
      .filter(Boolean);


  /*
   * ==========================================================
   * ADDRESS HIERARCHY
   * ==========================================================
   *
   * Example:
   *
   * BMS Institute of Technology & Management,
   * Doddaballapur Main Road,
   * Avalahalli,
   * Yelahanka,
   * Bengaluru,
   * 560119
   *
   * After organization + PIN removal:
   *
   * [0] Doddaballapur Main Road
   * [1] Avalahalli
   * [2] Yelahanka
   * [3] Bengaluru
   *
   * Therefore:
   *
   * Street  = Doddaballapur Main Road
   * Locality = Avalahalli
   *
   * ==========================================================
   */


  let streetAddress:
    string | null = null;

  let locality:
    string | null = null;


  /*
   * Find the road/street component.
   */

  const streetIndex =
    parts.findIndex(
      (part) =>
        isStreetLike(part)
    );


  if (
    streetIndex >= 0
  ) {

    /*
     * Road is the street address.
     */

    streetAddress =
      parts[streetIndex];


    /*
     * The component immediately
     * following the road is normally
     * the locality.
     */

    if (
      parts.length >
      streetIndex + 1
    ) {
      locality =
        parts[
          streetIndex + 1
        ];
    }

  } else {

    /*
     * If no road indicator exists,
     * use the first component as the
     * street/address component.
     */

    if (
      parts.length >= 1
    ) {
      streetAddress =
        parts[0];
    }

    if (
      parts.length >= 2
    ) {
      locality =
        parts[1];
    }
  }


  /*
   * ----------------------------------------------------------
   * PREVENT SAME VALUE IN BOTH FIELDS
   * ----------------------------------------------------------
   */

  if (
    streetAddress &&
    locality &&
    normalizeValue(
      streetAddress
    ) ===
      normalizeValue(
        locality
      )
  ) {
    locality = null;
  }


  /*
   * ----------------------------------------------------------
   * CITY / STATE / COUNTRY
   * ----------------------------------------------------------
   *
   * Do not guess these from arbitrary text.
   *
   * The geocoder is responsible for these.
   * ----------------------------------------------------------
   */

  const city:
    string | null = null;

  const stateProvince:
    string | null = null;

  const country:
    string | null = null;


  return {
    streetAddress,

    locality,

    city,

    stateProvince,

    country,

    postalCode,
  };
}


/* ============================================================
   ADD LOCATION
============================================================ */

function addLocation(
  locations: ExtractedLocation[],
  address: string,
  organizationName: string | null,
  source: string,
  confidence:
    | "High"
    | "Medium"
    | "Low"
) {

  const cleanedAddress =
    cleanAddressText(
      address
    );


  if (
    !isPossibleAddress(
      cleanedAddress
    )
  ) {
    return;
  }


  const parsed =
    parseAddress(
      cleanedAddress,
      organizationName
    );


  /*
   * Do not add duplicate full addresses.
   */

  const alreadyExists =
    locations.some(
      (location) =>
        location.fullAddress
          .toLowerCase() ===
        cleanedAddress
          .toLowerCase()
    );


  if (
    alreadyExists
  ) {
    return;
  }


  locations.push({
    organizationName,

    fullAddress:
      cleanedAddress,

    streetAddress:
      parsed.streetAddress,

    locality:
      parsed.locality,

    city:
      parsed.city,

    stateProvince:
      parsed.stateProvince,

    country:
      parsed.country,

    postalCode:
      parsed.postalCode,

    source,

    confidence,

    isPrimary:
      locations.length === 0,
  });
}


/* ============================================================
   JSON-LD
============================================================ */

function extractJsonLdAddresses(
  $: cheerio.CheerioAPI,

  locations: ExtractedLocation[],

  organizationName: string | null
) {

  $(
    "script[type='application/ld+json']"
  ).each(
    (_, element) => {

      try {

        const raw =
          $(element)
            .contents()
            .text();

        if (!raw) {
          return;
        }


        const data =
          JSON.parse(raw);


        const items =
          Array.isArray(data)
            ? data
            : [data];


        for (
          const item of items
        ) {

          const address =
            item?.address;


          if (!address) {
            continue;
          }


          /*
           * Address is a string.
           */

          if (
            typeof address ===
            "string"
          ) {

            addLocation(
              locations,

              address,

              organizationName,

              "Website structured data",

              "High"
            );

            continue;
          }


          /*
           * Address is a PostalAddress object.
           *
           * IMPORTANT:
           *
           * We preserve the order:
           *
           * streetAddress
           * addressLocality
           * addressRegion
           * postalCode
           * addressCountry
           */

          const parts = [
            address.streetAddress,

            address.addressLocality,

            address.addressRegion,

            address.postalCode,

            address.addressCountry,
          ].filter(Boolean);


          if (
            parts.length > 0
          ) {

            addLocation(
              locations,

              parts.join(", "),

              organizationName,

              "Website structured data",

              "High"
            );
          }
        }

      } catch {
        /*
         * Ignore invalid JSON-LD.
         */
      }
    }
  );
}


/* ============================================================
   ADDRESS TAG
============================================================ */

function extractAddressTags(
  $: cheerio.CheerioAPI,

  locations: ExtractedLocation[],

  organizationName: string | null
) {

  $("address").each(
    (_, element) => {

      const text =
        cleanAddressText(
          $(element).text()
        );


      if (
        isPossibleAddress(text)
      ) {

        addLocation(
          locations,

          text,

          organizationName,

          "Website address tag",

          "High"
        );
      }
    }
  );
}


/* ============================================================
   MICRODATA
============================================================ */

function extractMicrodata(
  $: cheerio.CheerioAPI,

  locations: ExtractedLocation[],

  organizationName: string | null
) {

  $(
    "[itemprop='address']"
  ).each(
    (_, element) => {

      const parts: string[] =
        [];


      $(
        element
      )
        .find(
          "[itemprop='streetAddress'], [itemprop='addressLocality'], [itemprop='addressRegion'], [itemprop='postalCode'], [itemprop='addressCountry']"
        )
        .each(
          (_, child) => {

            const value =
              cleanText(
                $(child).text() ||
                  $(child).attr(
                    "content"
                  )
              );


            if (value) {
              parts.push(
                value
              );
            }
          }
        );


      const directText =
        cleanAddressText(
          $(element).text()
        );


      const address =
        parts.length > 0
          ? parts.join(", ")
          : directText;


      if (
        isPossibleAddress(
          address
        )
      ) {

        addLocation(
          locations,

          address,

          organizationName,

          "Website microdata",

          "High"
        );
      }
    }
  );
}


/* ============================================================
   ADDRESS-LIKE WEBSITE CONTENT
============================================================ */

function extractAddressLikeText(
  $: cheerio.CheerioAPI,

  locations: ExtractedLocation[],

  organizationName: string | null
) {

  const selectors = [

    "footer address",

    "footer p",

    "footer li",

    "footer span",

    "header address",

    "main address",

    "main p",

    "main li",

    "section address",

    "section p",

    "section li",

    "p",

    "li",
  ];


  for (
    const selector of selectors
  ) {

    $(selector).each(
      (_, element) => {

        const text =
          cleanAddressText(
            $(element).text()
          );


        if (
          !isPossibleAddress(text)
        ) {
          return;
        }


        addLocation(
          locations,

          text,

          organizationName,

          "Website content",

          "Medium"
        );
      }
    );
  }
}


/* ============================================================
   MAIN ADDRESS EXTRACTION FUNCTION
============================================================ */

export function extractAddressesFromWebsite(
  url: string,
  html: string
): {
  locations: ExtractedLocation[];
} {

  const $ =
    cheerio.load(html);


  const locations:
    ExtractedLocation[] =
    [];


  /*
   * Organization name
   */

  const organizationName =
    getOrganizationName($);


  /*
   * 1. JSON-LD
   */

  extractJsonLdAddresses(
    $,

    locations,

    organizationName
  );


  /*
   * 2. <address>
   */

  extractAddressTags(
    $,

    locations,

    organizationName
  );


  /*
   * 3. Microdata
   */

  extractMicrodata(
    $,

    locations,

    organizationName
  );


  /*
   * 4. Normal website text
   */

  extractAddressLikeText(
    $,

    locations,

    organizationName
  );


  /*
   * First address is primary.
   */

  locations.forEach(
    (location, index) => {

      location.isPrimary =
        index === 0;
    }
  );


  return {
    locations,
  };
}