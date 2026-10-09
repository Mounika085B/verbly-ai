export type NearbyPlace = {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceKm: number;
  category: string;
  placeId?: string;
  sourceCategories?: string[];
};

export type NearbyPlacesResult = {
  radiusKm: number;

  governmentProjects: NearbyPlace[];

  hospitals: NearbyPlace[];
  schools: NearbyPlace[];
  governmentOffices: NearbyPlace[];

  historicalPlaces: NearbyPlace[];
  touristAttractions: NearbyPlace[];
  religiousPlaces: NearbyPlace[];

  policeFire: NearbyPlace[];
  banksAtms: NearbyPlace[];
  parks: NearbyPlace[];
  airportsRailMetro: NearbyPlace[];
};

/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const RADIUS_KM = 5;
const RADIUS_METERS = 5000;
const MAX_RESULTS = 5;

const GEOAPIFY_URL =
  "https://api.geoapify.com/v2/places";

/*
 * ============================================================
 * EMPTY RESULT
 * ============================================================
 */

function createEmptyResult(): NearbyPlacesResult {
  return {
    radiusKm: RADIUS_KM,

    governmentProjects: [],

    hospitals: [],
    schools: [],
    governmentOffices: [],

    historicalPlaces: [],
    touristAttractions: [],
    religiousPlaces: [],

    policeFire: [],
    banksAtms: [],
    parks: [],
    airportsRailMetro: [],
  };
}

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
 * CHECK WHETHER RESULT IS THE SAME ORGANIZATION
 * ============================================================
 */

function isSameOrganization(
  placeName: string,
  organizationName: string | null
): boolean {
  if (!organizationName) {
    return false;
  }

  const place =
    normalizeName(placeName);

  const organization =
    normalizeName(organizationName);

  if (!place || !organization) {
    return false;
  }

  /*
   * Exact match.
   */
  if (place === organization) {
    return true;
  }

  /*
   * Remove common organization suffixes
   * before comparison.
   */
  const cleanOrganization =
    organization
      .replace(
        /\b(bangalore|bengaluru|india)\b/g,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

  const cleanPlace =
    place
      .replace(
        /\b(bangalore|bengaluru|india)\b/g,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

  if (
    cleanOrganization &&
    cleanPlace &&
    (
      cleanOrganization === cleanPlace ||
      cleanOrganization.includes(cleanPlace) ||
      cleanPlace.includes(cleanOrganization)
    )
  ) {
    return true;
  }

  /*
   * Token-based comparison.
   *
   * Example:
   *
   * BMS Institute of Technology and Management
   *
   * BMS Institute of Technology and Management Bangalore
   *
   * are treated as the same organization.
   */

  const organizationWords =
    cleanOrganization
      .split(" ")
      .filter(
        word => word.length >= 3
      );

  const placeWords =
    cleanPlace
      .split(" ")
      .filter(
        word => word.length >= 3
      );

  if (
    organizationWords.length >= 3 &&
    placeWords.length >= 3
  ) {
    const matchingWords =
      organizationWords.filter(
        word =>
          placeWords.includes(word)
      );

    const matchRatio =
      matchingWords.length /
      organizationWords.length;

    if (matchRatio >= 0.7) {
      return true;
    }
  }

  return false;
}

/*
 * ============================================================
 * NAME FILTER
 * ============================================================
 */

function nameContains(
  name: string,
  words: string[]
): boolean {
  const normalized =
    normalizeName(name);

  return words.some(
    word =>
      normalized.includes(
        normalizeName(word)
      )
  );
}

/*
 * ============================================================
 * CATEGORY CHECK
 * ============================================================
 */

function hasCategory(
  categories: string[],
  allowed: string[]
): boolean {
  return categories.some(
    category =>
      allowed.some(
        allowedCategory =>
          category === allowedCategory ||
          category.startsWith(
            `${allowedCategory}.`
          )
      )
  );
}

/*
 * ============================================================
 * CATEGORY VALIDATION
 * ============================================================
 */

function isValidForCategory(
  name: string,
  categories: string[],
  requestedCategory: string
): boolean {

  /*
   * ----------------------------------------------------------
   * HOSPITALS
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Hospitals & Clinics"
  ) {
    return hasCategory(
      categories,
      [
        "healthcare.hospital",
        "healthcare.clinic_or_praxis",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * SCHOOLS
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Schools & Universities"
  ) {
    const valid =
      hasCategory(
        categories,
        [
          "education.school",
          "education.university",
          "education.college",
        ]
      );

    if (!valid) {
      return false;
    }

    /*
     * Prevent sports grounds from
     * appearing as schools.
     */

    const invalidNames = [
      "football ground",
      "cricket ground",
      "football cricket ground",
      "sports ground",
      "sports field",
      "playground",
      "stadium",
      "basketball court",
      "tennis court",
      "volleyball court",
      "sports complex",
    ];

    return !nameContains(
      name,
      invalidNames
    );
  }

  /*
   * ----------------------------------------------------------
   * GOVERNMENT OFFICES
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Government Offices"
  ) {
    return hasCategory(
      categories,
      [
        "office.government",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * HISTORICAL PLACES
   * ----------------------------------------------------------
   *
   * We intentionally use only specific
   * historical/tourism categories.
   *
   * We DO NOT use:
   *
   *     historic
   *
   * because that was causing the
   * Geoapify HTTP 400 problem.
   */

  if (
    requestedCategory ===
    "Old / Historical Places"
  ) {
    return hasCategory(
      categories,
      [
        "tourism.sights.archaeological_site",
        "tourism.sights.battlefield",
        "tourism.sights.castle",
        "tourism.sights.city_gate",
        "tourism.sights.fort",
        "tourism.sights.manor",
        "tourism.sights.memorial",
        "tourism.sights.monument",
        "tourism.sights.monastery",
        "tourism.sights.ruines",
        "tourism.sights.tower",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * TOURIST ATTRACTIONS
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Tourist Attractions"
  ) {
    const valid =
      hasCategory(
        categories,
        [
          "tourism.attraction",
          "tourism.sights",
          "entertainment.museum",
          "entertainment.zoo",
          "entertainment.aquarium",
          "entertainment.theme_park",
        ]
      );

    if (!valid) {
      return false;
    }

    const invalidNames = [
      "aircraft model",
      "elephant",
      "statue",
      "sculpture",
      "artwork",
      "model",
    ];

    return !nameContains(
      name,
      invalidNames
    );
  }

  /*
   * ----------------------------------------------------------
   * RELIGIOUS PLACES
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Religious Places"
  ) {
    return hasCategory(
      categories,
      [
        "religion",
        "religion.place_of_worship",
        "tourism.sights.place_of_worship",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * POLICE / FIRE
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Police & Fire Stations"
  ) {
    return hasCategory(
      categories,
      [
        "service.police",
        "service.fire_station",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * BANKS / ATMS
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Banks & ATMs"
  ) {
    return hasCategory(
      categories,
      [
        "service.financial.bank",
        "service.financial.atm",
      ]
    );
  }

  /*
   * ----------------------------------------------------------
   * PARKS
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Parks"
  ) {
    const valid =
      hasCategory(
        categories,
        [
          "leisure.park",
        ]
      );

    if (!valid) {
      return false;
    }

    const invalidNames = [
      "school",
      "college",
      "university",
      "hospital",
      "stadium",
      "football",
      "cricket",
      "sports ground",
      "sports field",
      "playground",
    ];

    return !nameContains(
      name,
      invalidNames
    );
  }

  /*
   * ----------------------------------------------------------
   * AIRPORT / RAIL / METRO
   * ----------------------------------------------------------
   */

  if (
    requestedCategory ===
    "Airports, Rail & Metro"
  ) {
    const valid =
      hasCategory(
        categories,
        [
          "airport",
          "public_transport.train",
          "public_transport.subway",
        ]
      );

    if (!valid) {
      return false;
    }

    const invalidNames = [
      "phase 2",
      "phase 2b",
      "phase 3",
      "construction",
      "under construction",
      "proposed",
      "project",
      "corridor",
      "extension",
    ];

    return !nameContains(
      name,
      invalidNames
    );
  }

  return false;
}

/*
 * ============================================================
 * ADD PLACE WITHOUT DUPLICATES
 * ============================================================
 */

function addPlace(
  list: NearbyPlace[],
  place: NearbyPlace
): void {

  const newName =
    normalizeName(place.name);

  const duplicate =
    list.some(existing => {

      /*
       * Best duplicate check:
       * Geoapify place_id.
       */

      if (
        existing.placeId &&
        place.placeId &&
        existing.placeId ===
          place.placeId
      ) {
        return true;
      }

      /*
       * Same normalized name
       * and very close coordinates.
       */

      const existingName =
        normalizeName(
          existing.name
        );

      const sameName =
        existingName === newName ||
        existingName.includes(newName) ||
        newName.includes(existingName);

      if (!sameName) {
        return false;
      }

      const distance =
        getDistanceKm(
          existing.latitude,
          existing.longitude,
          place.latitude,
          place.longitude
        );

      return distance <= 0.1;
    });

  if (!duplicate) {
    list.push(place);
  }
}

/*
 * ============================================================
 * GEOAPIFY FEATURE → OUR FORMAT
 * ============================================================
 */

function convertFeature(
  feature: any,
  latitude: number,
  longitude: number,
  category: string,
  organizationName: string | null
): NearbyPlace | null {

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

  /*
   * We only display named places.
   */

  if (!name) {
    return null;
  }

  /*
   * Never show the organization
   * itself as a nearby place.
   */

  if (
    isSameOrganization(
      name,
      organizationName
    )
  ) {
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

  /*
   * Only accept places that actually
   * belong to the requested category.
   */

  if (
    !isValidForCategory(
      name,
      categories,
      category
    )
  ) {
    return null;
  }

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

  const placeId =
    typeof properties.place_id ===
    "string"
      ? properties.place_id
      : undefined;

  return {
    name,

    latitude: placeLatitude,

    longitude: placeLongitude,

    address,

    distanceKm:
      Number(
        distanceKm.toFixed(2)
      ),

    category,

    placeId,

    sourceCategories:
      categories,
  };
}

/*
 * ============================================================
 * SEARCH ONE CATEGORY
 * ============================================================
 */

async function searchCategory(
  latitude: number,
  longitude: number,
  categories: string,
  categoryName: string,
  organizationName: string | null
): Promise<NearbyPlace[]> {

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
      categories
    );

    /*
     * Exact 5 km radius.
     */

    params.set(
      "filter",
      `circle:${longitude},${latitude},${RADIUS_METERS}`
    );

    /*
     * Nearest places first.
     */

    params.set(
      "bias",
      `proximity:${longitude},${latitude}`
    );

    /*
     * Retrieve enough results so
     * invalid/duplicate results can
     * be removed before selecting 5.
     */

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
      `[Geoapify] Searching ${categoryName}`
    );

    console.log(
      `[Geoapify] Categories: ${categories}`
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
        `[Geoapify] ${categoryName} HTTP ${response.status}`
      );

      console.error(
        `[Geoapify] Response: ${errorText}`
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

    const places:
      NearbyPlace[] = [];

    for (
      const feature of features
    ) {

      const place =
        convertFeature(
          feature,
          latitude,
          longitude,
          categoryName,
          organizationName
        );

      if (!place) {
        continue;
      }

      addPlace(
        places,
        place
      );
    }

    /*
     * Nearest first.
     */

    places.sort(
      (a, b) =>
        a.distanceKm -
        b.distanceKm
    );

    /*
     * Maximum 5.
     */

    return places.slice(
      0,
      MAX_RESULTS
    );

  } catch (error) {

    console.error(
      `[Geoapify] ${categoryName} search failed:`,
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

export async function findNearbyPlaces(
  latitude: number,
  longitude: number,
  radiusKm: number = 5,
  organizationName: string | null = null
): Promise<NearbyPlacesResult> {

  /*
   * This project always uses 5 km.
   */

  radiusKm = 5;

  const result =
    createEmptyResult();

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {

    console.error(
      "Invalid coordinates:",
      latitude,
      longitude
    );

    return result;
  }

  console.log(
    "===================================="
  );

  console.log(
    "LOCATION INTELLIGENCE - NEARBY SEARCH"
  );

  console.log(
    "Radius: 5 km"
  );

  console.log(
    "Coordinates:",
    latitude,
    longitude
  );

  console.log(
    "Organization:",
    organizationName
  );

  console.log(
    "===================================="
  );

  /*
   * ==========================================================
   * HISTORICAL CATEGORIES
   * ==========================================================
   *
   * IMPORTANT:
   *
   * We intentionally do NOT use:
   *
   *     historic
   *
   * because that caused the HTTP 400 error.
   *
   * These are specific Geoapify tourism
   * sight categories.
   */

  const historicalCategories = [
    "tourism.sights.archaeological_site",
    "tourism.sights.battlefield",
    "tourism.sights.castle",
    "tourism.sights.city_gate",
    "tourism.sights.fort",
    "tourism.sights.manor",
    "tourism.sights.memorial",
    "tourism.sights.monument",
    "tourism.sights.monastery",
    "tourism.sights.ruines",
    "tourism.sights.tower",
  ];

  /*
   * ==========================================================
   * SEARCH ALL CATEGORIES
   * ==========================================================
   */

  const [
    hospitals,

    schools,

    governmentOffices,

    historicalPlaces,

    touristAttractions,

    religiousPlaces,

    policeFire,

    banksAtms,

    parks,

    airportsRailMetro,

  ] = await Promise.all([

    /*
     * --------------------------------------------------------
     * HOSPITALS
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "healthcare.hospital,healthcare.clinic_or_praxis",
      "Hospitals & Clinics",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * SCHOOLS
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "education.school,education.university,education.college",
      "Schools & Universities",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * GOVERNMENT OFFICES
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "office.government",
      "Government Offices",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * HISTORICAL PLACES
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We search each historical category
     * separately.
     *
     * This makes it easier to identify
     * which category is returning results
     * and prevents one invalid category
     * from breaking the entire request.
     */

    Promise.all(
      historicalCategories.map(
        category =>
          searchCategory(
            latitude,
            longitude,
            category,
            "Old / Historical Places",
            organizationName
          )
      )
    ).then(
      arrays => {

        const combined:
          NearbyPlace[] = [];

        for (
          const places of arrays
        ) {
          for (
            const place of places
          ) {
            addPlace(
              combined,
              place
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
    ),

    /*
     * --------------------------------------------------------
     * TOURIST ATTRACTIONS
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      [
        "tourism.attraction",
        "tourism.sights",
        "entertainment.museum",
        "entertainment.zoo",
        "entertainment.aquarium",
        "entertainment.theme_park",
      ].join(","),
      "Tourist Attractions",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * RELIGIOUS PLACES
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We DO NOT use:
     *
     *     place_of_worship
     *
     * by itself.
     *
     * We use the supported hierarchical
     * categories.
     */

    searchCategory(
      latitude,
      longitude,
      [
        "religion",
        "religion.place_of_worship",
        "tourism.sights.place_of_worship",
      ].join(","),
      "Religious Places",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * POLICE & FIRE
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "service.police,service.fire_station",
      "Police & Fire Stations",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * BANKS & ATMS
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "service.financial.bank,service.financial.atm",
      "Banks & ATMs",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * PARKS
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      "leisure.park",
      "Parks",
      organizationName
    ),

    /*
     * --------------------------------------------------------
     * AIRPORT / RAIL / METRO
     * --------------------------------------------------------
     */

    searchCategory(
      latitude,
      longitude,
      [
        "airport",
        "public_transport.train",
        "public_transport.subway",
      ].join(","),
      "Airports, Rail & Metro",
      organizationName
    ),
  ]);

  /*
   * ==========================================================
   * SAVE RESULTS
   * ==========================================================
   */

  result.hospitals =
    hospitals;

  result.schools =
    schools;

  result.governmentOffices =
    governmentOffices;

  result.historicalPlaces =
    historicalPlaces;

  result.touristAttractions =
    touristAttractions;

  result.religiousPlaces =
    religiousPlaces;

  result.policeFire =
    policeFire;

  result.banksAtms =
    banksAtms;

  result.parks =
    parks;

  result.airportsRailMetro =
    airportsRailMetro;

  /*
   * Government projects remain empty.
   *
   * We do NOT pretend that a government
   * office is a government project.
   */

  result.governmentProjects =
    [];

  /*
   * ==========================================================
   * LOG FINAL RESULTS
   * ==========================================================
   */

  console.log(
    "===================================="
  );

  console.log(
    "FINAL NEARBY RESULTS"
  );

  console.log({
    hospitals:
      result.hospitals.length,

    schools:
      result.schools.length,

    governmentOffices:
      result.governmentOffices.length,

    historicalPlaces:
      result.historicalPlaces.length,

    touristAttractions:
      result.touristAttractions.length,

    religiousPlaces:
      result.religiousPlaces.length,

    policeFire:
      result.policeFire.length,

    banksAtms:
      result.banksAtms.length,

    parks:
      result.parks.length,

    airportsRailMetro:
      result.airportsRailMetro.length,
  });

  console.log(
    "===================================="
  );

  return result;
}