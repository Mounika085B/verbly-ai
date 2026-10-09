type GeocodableLocation = {
  organizationName?: string | null;
  fullAddress?: string | null;
  streetAddress?: string | null;
  locality?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

type GeoapifyResult = {
  lat?: number;
  lon?: number;

  name?: string;
  formatted?: string;

  street?: string;
  housenumber?: string;

  suburb?: string;
  district?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;

  result_type?: string;

  rank?: {
    confidence?: number;
    confidence_city_level?: number;
    confidence_street_level?: number;
    confidence_building_level?: number;
  };
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  address?: NominatimAddress;
};

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
  source: "Geoapify" | "Nominatim";
};

/*
 * ============================================================
 * TEXT NORMALIZATION
 * ============================================================
 */

function normalize(
  value?: string | null
): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * ============================================================
 * TOKENS
 * ============================================================
 */

function getTokens(
  value?: string | null
): string[] {
  return normalize(value)
    .split(" ")
    .filter(
      (token) => token.length >= 3
    );
}

/*
 * ============================================================
 * POSTAL CODE
 * ============================================================
 */

function postalMatches(
  sourcePostal?: string | null,
  resultPostal?: string | null
): boolean {
  if (
    !sourcePostal ||
    !resultPostal
  ) {
    return false;
  }

  const source =
    sourcePostal.replace(
      /\D/g,
      ""
    );

  const result =
    resultPostal.replace(
      /\D/g,
      ""
    );

  return (
    source.length > 0 &&
    result.length > 0 &&
    source === result
  );
}

/*
 * ============================================================
 * CLEAN ADDRESS
 *
 * Removes common punctuation that can make a geocoder query
 * unnecessarily difficult.
 * ============================================================
 */

function cleanAddress(
  value?: string | null
): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\s*-\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/^,\s*|\s*,$/g, "")
    .trim();
}

/*
 * ============================================================
 * BUILD GENERIC QUERIES
 *
 * IMPORTANT:
 *
 * These are generated from the detected address.
 *
 * Nothing here is hardcoded to BMSIT.
 * ============================================================
 */

function buildQueries(
  location: GeocodableLocation
): string[] {
  const queries: string[] = [];

  const full =
    cleanAddress(
      location.fullAddress
    );

  const organization =
    cleanAddress(
      location.organizationName
    );

  const street =
    cleanAddress(
      location.streetAddress
    );

  const locality =
    cleanAddress(
      location.locality
    );

  const city =
    cleanAddress(
      location.city
    );

  const state =
    cleanAddress(
      location.stateProvince
    );

  const country =
    cleanAddress(
      location.country
    );

  const postal =
    cleanAddress(
      location.postalCode
    );

  /*
   * ----------------------------------------------------------
   * 1. ORIGINAL FULL ADDRESS
   * ----------------------------------------------------------
   */

  if (full) {
    queries.push(full);
  }

  /*
   * ----------------------------------------------------------
   * 2. FULL ADDRESS + COUNTRY
   * ----------------------------------------------------------
   */

  if (
    full &&
    country &&
    !normalize(full).includes(
      normalize(country)
    )
  ) {
    queries.push(
      `${full}, ${country}`
    );
  }

  /*
   * ----------------------------------------------------------
   * 3. ORGANIZATION + ADDRESS
   * ----------------------------------------------------------
   */

  if (
    organization &&
    full
  ) {
    queries.push(
      `${organization}, ${full}`
    );
  }

  /*
   * ----------------------------------------------------------
   * 4. STREET + LOCALITY + CITY + STATE + POSTAL
   * ----------------------------------------------------------
   */

  const structured =
    [
      street,
      locality,
      city,
      state,
      postal,
      country,
    ].filter(Boolean);

  if (
    structured.length > 0
  ) {
    queries.push(
      structured.join(", ")
    );
  }

  /*
   * ----------------------------------------------------------
   * 5. STREET + POSTAL
   * ----------------------------------------------------------
   */

  if (
    street &&
    postal
  ) {
    queries.push(
      `${street}, ${postal}`
    );
  }

  /*
   * ----------------------------------------------------------
   * 6. ORGANIZATION + POSTAL
   * ----------------------------------------------------------
   */

  if (
    organization &&
    postal
  ) {
    queries.push(
      `${organization}, ${postal}`
    );
  }

  /*
   * ----------------------------------------------------------
   * 7. LOCALITY + POSTAL
   * ----------------------------------------------------------
   */

  if (
    locality &&
    postal
  ) {
    queries.push(
      `${locality}, ${postal}`
    );
  }

  /*
   * ----------------------------------------------------------
   * 8. IMPORTANT GENERIC FALLBACK
   *
   * Take useful geographic terms directly from the full
   * address when structured fields are missing.
   *
   * This is what helps addresses where city/state were not
   * extracted separately.
   * ----------------------------------------------------------
   */

  if (
    full &&
    postal
  ) {
    const withoutPostal =
      full
        .replace(
          new RegExp(
            postal.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            ),
            "gi"
          ),
          ""
        )
        .replace(
          /,\s*,/g,
          ","
        )
        .trim();

    if (withoutPostal) {
      queries.push(
        `${withoutPostal}, ${postal}`
      );
    }
  }

  /*
   * Remove duplicates.
   */

  return [
    ...new Set(
      queries
        .map(cleanAddress)
        .filter(Boolean)
    ),
  ];
}

/*
 * ============================================================
 * SCORE GEOAPIFY RESULT
 * ============================================================
 */

function scoreGeoapifyCandidate(
  candidate: GeoapifyResult,
  location: GeocodableLocation
): number {
  let score = 0;

  const display =
    normalize(
      candidate.formatted ||
        candidate.name
    );

  const resultPostcode =
    candidate.postcode;

  /*
   * ----------------------------------------------------------
   * POSTAL CODE
   * ----------------------------------------------------------
   */

  if (
    location.postalCode &&
    resultPostcode
  ) {
    if (
      postalMatches(
        location.postalCode,
        resultPostcode
      )
    ) {
      score += 100;
    } else {
      score -= 35;
    }
  }

  /*
   * ----------------------------------------------------------
   * CITY
   * ----------------------------------------------------------
   */

  if (
    location.city
  ) {
    const city =
      normalize(
        location.city
      );

    if (
      display.includes(city)
    ) {
      score += 40;
    }
  }

  /*
   * ----------------------------------------------------------
   * STATE
   * ----------------------------------------------------------
   */

  if (
    location.stateProvince
  ) {
    const state =
      normalize(
        location.stateProvince
      );

    if (
      display.includes(state)
    ) {
      score += 30;
    }
  }

  /*
   * ----------------------------------------------------------
   * LOCALITY
   * ----------------------------------------------------------
   */

  if (
    location.locality
  ) {
    const localityTokens =
      getTokens(
        location.locality
      );

    let matches = 0;

    for (
      const token of
        localityTokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      45,
      matches * 15
    );
  }

  /*
   * ----------------------------------------------------------
   * STREET
   * ----------------------------------------------------------
   */

  if (
    location.streetAddress
  ) {
    const streetTokens =
      getTokens(
        location.streetAddress
      );

    let matches = 0;

    for (
      const token of
        streetTokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      60,
      matches * 15
    );
  }

  /*
   * ----------------------------------------------------------
   * FULL ADDRESS
   * ----------------------------------------------------------
   */

  if (
    location.fullAddress
  ) {
    const tokens =
      getTokens(
        location.fullAddress
      );

    let matches = 0;

    for (
      const token of
        tokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      70,
      matches * 5
    );
  }

  /*
   * ----------------------------------------------------------
   * ORGANIZATION
   * ----------------------------------------------------------
   */

  if (
    location.organizationName
  ) {
    const organizationTokens =
      getTokens(
        location.organizationName
      );

    let matches = 0;

    for (
      const token of
        organizationTokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    if (
      matches >= 3
    ) {
      score += 35;
    } else if (
      matches >= 2
    ) {
      score += 25;
    } else if (
      matches === 1
    ) {
      score += 10;
    }
  }

  /*
   * ----------------------------------------------------------
   * GEOAPIFY CONFIDENCE
   * ----------------------------------------------------------
   */

  const confidence =
    candidate.rank
      ?.confidence;

  if (
    typeof confidence ===
    "number"
  ) {
    score +=
      Math.min(
        20,
        confidence * 20
      );
  }

  /*
   * ----------------------------------------------------------
   * RESULT TYPE
   * ----------------------------------------------------------
   *
   * An amenity/building result is preferable to a generic
   * city/locality result.
   * ----------------------------------------------------------
   */

  if (
    candidate.result_type ===
    "amenity"
  ) {
    score += 25;
  }

  return score;
}

/*
 * ============================================================
 * GEOAPIFY GEOCODER
 * ============================================================
 */

async function geocodeWithGeoapify(
  location: GeocodableLocation
): Promise<GeocodedLocation | null> {
  const apiKey =
    process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    console.warn(
      "[Geoapify Geocoder] GEOAPIFY_API_KEY is missing."
    );

    return null;
  }

  const queries =
    buildQueries(location);

  if (
    queries.length === 0
  ) {
    return null;
  }

  let bestCandidate:
    | GeoapifyResult
    | null = null;

  let bestScore =
    -Infinity;

  console.log(
    "[Geoapify Geocoder] Queries:",
    queries
  );

  for (
    const query of queries
  ) {
    try {
      const params =
        new URLSearchParams();

      params.set(
        "text",
        query
      );

      params.set(
        "format",
        "json"
      );

      params.set(
        "limit",
        "10"
      );

      params.set(
        "lang",
        "en"
      );

      params.set(
        "apiKey",
        apiKey
      );

      /*
       * If we know the country, restrict the search.
       *
       * This prevents a generic address from being
       * matched in another country.
       */

      if (
        location.country
      ) {
        const country =
          normalize(
            location.country
          );

        /*
         * India -> in
         */
        if (
          country ===
            "india" ||
          country ===
            "bharat"
        ) {
          params.set(
            "filter",
            "countrycode:in"
          );
        }
      }

      console.log(
        "[Geoapify Geocoder] Searching:",
        query
      );

      const response =
        await fetch(
          `${"https://api.geoapify.com/v1/geocode/search"}?${params.toString()}`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",
            },

            signal:
              AbortSignal.timeout(
                12000
              ),

            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        console.warn(
          "[Geoapify Geocoder] HTTP:",
          response.status
        );

        continue;
      }

      const data =
        await response.json();

      const results =
        Array.isArray(
          data?.results
        )
          ? data.results
          : [];

      console.log(
        "[Geoapify Geocoder] Results:",
        results.length
      );

      for (
        const candidate of
          results
      ) {
        const lat =
          Number(
            candidate?.lat
          );

        const lon =
          Number(
            candidate?.lon
          );

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          continue;
        }

        const score =
          scoreGeoapifyCandidate(
            candidate,
            location
          );

        console.log(
          "[Geoapify Geocoder] Candidate:",
          candidate.formatted ||
            candidate.name
        );

        console.log(
          "[Geoapify Geocoder] Score:",
          score
        );

        if (
          score >
          bestScore
        ) {
          bestScore =
            score;

          bestCandidate =
            candidate;
        }
      }
    } catch (error) {
      console.error(
        "[Geoapify Geocoder] Search error:",
        error
      );
    }
  }

  if (
    !bestCandidate
  ) {
    console.log(
      "[Geoapify Geocoder] No candidate found."
    );

    return null;
  }

  const latitude =
    Number(
      bestCandidate.lat
    );

  const longitude =
    Number(
      bestCandidate.lon
    );

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return null;
  }

  /*
   * ----------------------------------------------------------
   * SAFETY THRESHOLD
   * ----------------------------------------------------------
   *
   * We do NOT accept a weak random city/place result.
   */

  if (
    bestScore < 100
  ) {
    console.log(
      "[Geoapify Geocoder] Candidate rejected because score is too low:",
      bestScore
    );

    return null;
  }

  console.log(
    "[Geoapify Geocoder] Best candidate:",
    bestCandidate.formatted ||
      bestCandidate.name
  );

  console.log(
    "[Geoapify Geocoder] Best score:",
    bestScore
  );

  console.log(
    "[Geoapify Geocoder] Coordinates:",
    latitude,
    longitude
  );

  return {
    latitude,
    longitude,

    displayName:
      bestCandidate.formatted ||
      bestCandidate.name ||
      "Geocoded location",

    source:
      "Geoapify",
  };
}

/*
 * ============================================================
 * NOMINATIM FALLBACK
 * ============================================================
 */

async function searchNominatim(
  query: string
): Promise<NominatimResult[]> {
  const params =
    new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "10",
    });

  const response =
    await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        method: "GET",

        headers: {
          "User-Agent":
            "VerblyAI-LocationIntelligence/1.0",
          Accept:
            "application/json",
        },

        signal:
          AbortSignal.timeout(
            12000
          ),

        cache:
          "no-store",
      }
    );

  if (
    !response.ok
  ) {
    return [];
  }

  const data =
    await response.json();

  return Array.isArray(data)
    ? data
    : [];
}

/*
 * ============================================================
 * NOMINATIM SCORING
 * ============================================================
 */

function scoreNominatimCandidate(
  candidate: NominatimResult,
  location: GeocodableLocation
): number {
  const display =
    normalize(
      candidate.display_name
    );

  let score = 0;

  /*
   * Postal code.
   */

  if (
    location.postalCode &&
    candidate.address?.postcode
  ) {
    if (
      postalMatches(
        location.postalCode,
        candidate.address.postcode
      )
    ) {
      score += 100;
    } else {
      score -= 40;
    }
  }

  /*
   * Locality.
   */

  if (
    location.locality
  ) {
    const tokens =
      getTokens(
        location.locality
      );

    let matches = 0;

    for (
      const token of
        tokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      50,
      matches * 15
    );
  }

  /*
   * Street.
   */

  if (
    location.streetAddress
  ) {
    const tokens =
      getTokens(
        location.streetAddress
      );

    let matches = 0;

    for (
      const token of
        tokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      60,
      matches * 15
    );
  }

  /*
   * Full address.
   */

  if (
    location.fullAddress
  ) {
    const tokens =
      getTokens(
        location.fullAddress
      );

    let matches = 0;

    for (
      const token of
        tokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    score += Math.min(
      70,
      matches * 5
    );
  }

  /*
   * Organization.
   */

  if (
    location.organizationName
  ) {
    const tokens =
      getTokens(
        location.organizationName
      );

    let matches = 0;

    for (
      const token of
        tokens
    ) {
      if (
        display.includes(token)
      ) {
        matches++;
      }
    }

    if (
      matches >= 3
    ) {
      score += 35;
    } else if (
      matches >= 2
    ) {
      score += 25;
    } else if (
      matches === 1
    ) {
      score += 10;
    }
  }

  return score;
}

/*
 * ============================================================
 * NOMINATIM FALLBACK
 * ============================================================
 */

async function geocodeWithNominatim(
  location: GeocodableLocation
): Promise<GeocodedLocation | null> {
  const queries =
    buildQueries(location);

  let best:
    | NominatimResult
    | null = null;

  let bestScore =
    -Infinity;

  console.log(
    "[Nominatim] Queries:",
    queries
  );

  for (
    const query of queries
  ) {
    try {
      console.log(
        "[Nominatim] Searching:",
        query
      );

      const results =
        await searchNominatim(
          query
        );

      for (
        const candidate of
          results
      ) {
        const score =
          scoreNominatimCandidate(
            candidate,
            location
          );

        console.log(
          "[Nominatim] Candidate:",
          candidate.display_name
        );

        console.log(
          "[Nominatim] Score:",
          score
        );

        if (
          score >
          bestScore
        ) {
          bestScore =
            score;

          best =
            candidate;
        }
      }
    } catch (error) {
      console.error(
        "[Nominatim] Error:",
        error
      );
    }
  }

  if (!best) {
    console.log(
      "[Nominatim] No candidate found."
    );

    return null;
  }

  /*
   * Strong evidence required.
   */

  if (
    bestScore < 100
  ) {
    console.log(
      "[Nominatim] Best candidate rejected. Score:",
      bestScore
    );

    return null;
  }

  const latitude =
    Number(best.lat);

  const longitude =
    Number(best.lon);

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return null;
  }

  return {
    latitude,
    longitude,

    displayName:
      best.display_name,

    source:
      "Nominatim",
  };
}

/*
 * ============================================================
 * MAIN GEOCODER
 * ============================================================
 */

export async function geocodeLocation(
  location: GeocodableLocation
): Promise<GeocodedLocation | null> {
  console.log(
    "===================================="
  );

  console.log(
    "[Geocoder] Starting"
  );

  console.log(
    "[Geocoder] Organization:",
    location.organizationName
  );

  console.log(
    "[Geocoder] Full address:",
    location.fullAddress
  );

  console.log(
    "[Geocoder] Postal code:",
    location.postalCode
  );

  console.log(
    "===================================="
  );

  /*
   * ----------------------------------------------------------
   * FIRST:
   * Geoapify
   * ----------------------------------------------------------
   *
   * This is now the primary geocoder because the project
   * already uses Geoapify for nearby Places.
   */

  const geoapifyResult =
    await geocodeWithGeoapify(
      location
    );

  if (
    geoapifyResult
  ) {
    console.log(
      "[Geocoder] SUCCESS using Geoapify."
    );

    return geoapifyResult;
  }

  /*
   * ----------------------------------------------------------
   * SECOND:
   * Nominatim fallback
   * ----------------------------------------------------------
   */

  console.log(
    "[Geocoder] Geoapify could not verify the address."
  );

  console.log(
    "[Geocoder] Trying Nominatim fallback..."
  );

  const nominatimResult =
    await geocodeWithNominatim(
      location
    );

  if (
    nominatimResult
  ) {
    console.log(
      "[Geocoder] SUCCESS using Nominatim."
    );

    return nominatimResult;
  }

  /*
   * ----------------------------------------------------------
   * FAILED
   * ----------------------------------------------------------
   */

  console.log(
    "[Geocoder] No reliable coordinates found."
  );

  return null;
}

/*
 * ============================================================
 * CONVENIENCE FUNCTION
 * ============================================================
 */

export async function geocodeAddress(
  address: string
): Promise<GeocodedLocation | null> {
  return geocodeLocation({
    fullAddress: address,
  });
}