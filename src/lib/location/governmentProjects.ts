export type GovernmentProject = {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceKm: number;
  category: string;
  placeId?: string;
  source: string;
};

const RADIUS_KM = 5;
const RADIUS_METERS = 5000;
const MAX_RESULTS = 5;

const GEOAPIFY_URL =
  "https://api.geoapify.com/v2/places";

/*
 * ============================================================
 * DISTANCE
 * ============================================================
 */

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

/*
 * ============================================================
 * NORMALIZE NAME
 * ============================================================
 */

function normalizeName(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * ============================================================
 * WORD CHECK
 * ============================================================
 */

function containsAny(
  text: string,
  words: string[]
): boolean {
  const normalized =
    normalizeName(text);

  return words.some(
    word =>
      normalized.includes(
        normalizeName(word)
      )
  );
}

/*
 * ============================================================
 * CHECK WHETHER IT LOOKS LIKE A PUBLIC/GOVERNMENT PROJECT
 * ============================================================
 *
 * IMPORTANT:
 *
 * We do NOT call every construction site
 * a government project.
 */

function isGovernmentProject(
  name: string,
  address: string | null,
  categories: string[]
): boolean {

  const combinedText = [
    name,
    address || "",
    categories.join(" "),
  ].join(" ");

  /*
   * Government/public authorities.
   */

  const governmentTerms = [
    "government",
    "govt",
    "public works",
    "pwd",
    "karnataka",
    "bbmp",
    "bmrcl",
    "bmrc",
    "bda",
    "bwssb",
    "kptcl",
    "bescom",
    "nhai",
    "nha",
    "railway",
    "indian railways",
    "national highway",
    "state highway",
    "metro rail",
  ];

  /*
   * Project/construction terms.
   */

  const projectTerms = [
    "construction",
    "under construction",
    "project",
    "development",
    "widening",
    "flyover",
    "metro",
    "railway",
    "bridge",
    "road work",
    "road development",
    "infrastructure",
    "sewerage",
    "water supply",
    "pipeline",
    "public works",
  ];

  const hasGovernmentTerm =
    containsAny(
      combinedText,
      governmentTerms
    );

  const hasProjectTerm =
    containsAny(
      combinedText,
      projectTerms
    );

  /*
   * Both types of evidence are required.
   */

  return (
    hasGovernmentTerm &&
    hasProjectTerm
  );
}

/*
 * ============================================================
 * CONVERT GEOAPIFY FEATURE
 * ============================================================
 */

function convertFeature(
  feature: any,
  latitude: number,
  longitude: number
): GovernmentProject | null {

  const properties =
    feature?.properties;

  if (!properties) {
    return null;
  }

  const name =
    typeof properties.name ===
    "string"
      ? properties.name.trim()
      : "";

  if (!name) {
    return null;
  }

  const placeLatitude =
    Number(properties.lat);

  const placeLongitude =
    Number(properties.lon);

  if (
    !Number.isFinite(
      placeLatitude
    ) ||
    !Number.isFinite(
      placeLongitude
    )
  ) {
    return null;
  }

  const distanceKm =
    getDistanceKm(
      latitude,
      longitude,
      placeLatitude,
      placeLongitude
    );

  /*
   * Hard 5 km boundary.
   */

  if (
    distanceKm > RADIUS_KM
  ) {
    return null;
  }

  const categories =
    Array.isArray(
      properties.categories
    )
      ? properties.categories.filter(
          (value: unknown) =>
            typeof value ===
            "string"
        )
      : [];

  const address =
    typeof properties.formatted ===
    "string"
      ? properties.formatted
      : [
          properties.address_line1,
          properties.address_line2,
        ]
          .filter(Boolean)
          .join(", ") ||
        null;

  /*
   * IMPORTANT:
   *
   * Do not call every railway/road/construction
   * feature a government project.
   */

  if (
    !isGovernmentProject(
      name,
      address,
      categories
    )
  ) {
    return null;
  }

  const placeId =
    typeof properties.place_id ===
    "string"
      ? properties.place_id
      : undefined;

  return {
    name,

    latitude:
      placeLatitude,

    longitude:
      placeLongitude,

    address,

    distanceKm:
      Number(
        distanceKm.toFixed(2)
      ),

    category:
      "Government Project",

    placeId,

    source:
      "Geoapify Places API",
  };
}

/*
 * ============================================================
 * DEDUPLICATION
 * ============================================================
 */

function addProject(
  list: GovernmentProject[],
  project: GovernmentProject
): void {

  const duplicate =
    list.some(existing => {

      /*
       * First preference:
       * Geoapify place_id.
       */

      if (
        existing.placeId &&
        project.placeId &&
        existing.placeId ===
          project.placeId
      ) {
        return true;
      }

      /*
       * Second preference:
       * same normalized name
       * within 100 metres.
       */

      const sameName =
        normalizeName(
          existing.name
        ) ===
        normalizeName(
          project.name
        );

      if (!sameName) {
        return false;
      }

      const distance =
        getDistanceKm(
          existing.latitude,
          existing.longitude,
          project.latitude,
          project.longitude
        );

      return distance <= 0.1;
    });

  if (!duplicate) {
    list.push(project);
  }
}

/*
 * ============================================================
 * SEARCH ONE GEOAPIFY CATEGORY
 * ============================================================
 */

async function searchConstructionCategory(
  latitude: number,
  longitude: number,
  category: string
): Promise<GovernmentProject[]> {

  const apiKey =
    process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    console.error(
      "GEOAPIFY_API_KEY is missing."
    );

    return [];
  }

  try {

    const params =
      new URLSearchParams();

    params.set(
      "categories",
      category
    );

    params.set(
      "filter",
      `circle:${longitude},${latitude},${RADIUS_METERS}`
    );

    params.set(
      "bias",
      `proximity:${longitude},${latitude}`
    );

    params.set(
      "limit",
      "50"
    );

    params.set(
      "apiKey",
      apiKey
    );

    params.set(
      "lang",
      "en"
    );

    console.log(
      `[Government Projects] Searching ${category}`
    );

    const response =
      await fetch(
        `${GEOAPIFY_URL}?${params.toString()}`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache: "no-store",

          signal:
            AbortSignal.timeout(
              12000
            ),
        }
      );

    if (!response.ok) {

      const errorText =
        await response.text();

      console.error(
        `[Government Projects] ${category} HTTP ${response.status}`
      );

      console.error(
        errorText
      );

      return [];
    }

    const data =
      await response.json();

    const features =
      Array.isArray(
        data?.features
      )
        ? data.features
        : [];

    const projects:
      GovernmentProject[] = [];

    for (
      const feature of features
    ) {

      const project =
        convertFeature(
          feature,
          latitude,
          longitude
        );

      if (!project) {
        continue;
      }

      addProject(
        projects,
        project
      );
    }

    projects.sort(
      (a, b) =>
        a.distanceKm -
        b.distanceKm
    );

    return projects;

  } catch (error) {

    console.error(
      `[Government Projects] ${category} failed:`,
      error
    );

    return [];
  }
}

/*
 * ============================================================
 * MAIN FUNCTION
 * ============================================================
 */

export async function findGovernmentProjects(
  latitude: number,
  longitude: number
): Promise<GovernmentProject[]> {

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return [];
  }

  /*
   * Geoapify specifically documents
   * railway.construction as railway
   * infrastructure currently under
   * construction.
   *
   * We also inspect construction-related
   * man-made/public infrastructure
   * categories, but we still require
   * government/public-project evidence
   * before returning a result.
   */

  const categories = [
    "railway.construction",
    "man_made.bridge",
    "man_made",
    "highway",
  ];

  const results =
    await Promise.all(
      categories.map(
        category =>
          searchConstructionCategory(
            latitude,
            longitude,
            category
          )
      )
    );

  const combined:
    GovernmentProject[] = [];

  for (
    const projects of results
  ) {

    for (
      const project of projects
    ) {

      addProject(
        combined,
        project
      );
    }
  }

  combined.sort(
    (a, b) =>
      a.distanceKm -
      b.distanceKm
  );

  return combined.slice(
    0,
    MAX_RESULTS
  );
}