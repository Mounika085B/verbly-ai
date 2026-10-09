"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface LocationIntelligenceProps {
  url: string;
}

interface NearbyPlace {
  name: string;
  address: string | null;
  distanceKm: number;
  category: string;
}

interface NearbyPlaces {
  radiusKm: number;

  hospitals: NearbyPlace[];
  schools: NearbyPlace[];
  governmentOffices: NearbyPlace[];
  governmentProjects: NearbyPlace[];
  historicalPlaces: NearbyPlace[];
  touristAttractions: NearbyPlace[];
  religiousPlaces: NearbyPlace[];
  policeFire: NearbyPlace[];
  banksAtms: NearbyPlace[];
  parks: NearbyPlace[];
  airportsRailMetro: NearbyPlace[];
}

interface WebsiteSuggestion {
  name: string;
  reason: string;
}

interface WebsiteAnalysis {
  websiteType: string;
  locationStatus: string;
  reason: string;
  suggestedWebsiteTypes: string[];
  confidence: "High" | "Medium" | "Low";
}

interface LocationResult {
  success: boolean;

  url?: string;

  hasPhysicalAddress: boolean;

  message?: string;

  location?: {
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
  } | null;

  coordinates?: {
    latitude: number;
    longitude: number;
    displayName?: string;
  } | null;

  nearbyPlaces?: NearbyPlaces | null;

  websiteAnalysis?: WebsiteAnalysis | null;

  suggestions?: WebsiteSuggestion[];
}

export default function LocationIntelligence({
  url,
}: LocationIntelligenceProps) {
  const [result, setResult] =
    useState<LocationResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [nearbyLoading, setNearbyLoading] =
    useState(false);

  const [nearbyError, setNearbyError] =
    useState("");

  const [error, setError] =
    useState("");

  /*
   * ============================================================
   * ANALYZE THE URL RECEIVED FROM THE MAIN WEBSITE ANALYZER
   * ============================================================
   */

  async function analyzeWebsite(websiteInput: string) {
    if (!websiteInput.trim()) {
      return;
    }

    setLoading(true);
    setNearbyLoading(false);
    setError("");
    setNearbyError("");
    setResult(null);

    try {
      let websiteUrl = websiteInput.trim();

      /*
       * Add https:// if necessary.
       */

      if (
        !websiteUrl.startsWith("http://") &&
        !websiteUrl.startsWith("https://")
      ) {
        websiteUrl = "https://" + websiteUrl;
      }

      /*
       * ========================================================
       * STEP 1
       * Analyze website and find physical address
       * ========================================================
       */

      const response = await fetch(
        "/verbly-ai/api/location",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            url: websiteUrl,
            radiusKm: 5,
          }),
        },
      );

      const contentType =
        response.headers.get("content-type");

      if (
        !contentType?.includes(
          "application/json",
        )
      ) {
        throw new Error(
          `API returned ${response.status} instead of JSON.`,
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to analyze the website.",
        );
      }

      console.log(
        "Location API response:",
        data,
      );

      /*
       * Show physical address immediately.
       */

      setResult({
        ...data,
        nearbyPlaces: null,
      });

      /*
       * ========================================================
       * STEP 2
       * Find nearby places
       * ========================================================
       */

      if (
        !data.hasPhysicalAddress ||
        !data.coordinates
      ) {
        setLoading(false);
        return;
      }

      setNearbyLoading(true);
      setNearbyError("");

      try {
        const nearbyResponse =
          await fetch(
            "/verbly-ai/api/location/nearby",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                latitude:
                  data.coordinates
                    .latitude,

                longitude:
                  data.coordinates
                    .longitude,

                /*
                 * Prevent the detected organization
                 * itself from appearing as a nearby place.
                 */

                organizationName:
                  data.location
                    ?.organizationName ||
                  data.locations?.find(
                    (location: any) =>
                      location.isPrimary,
                  )
                    ?.organizationName ||
                  null,

                /*
                 * Always use 5 km.
                 */

                radiusKm: 5,
              }),
            },
          );

        const nearbyContentType =
          nearbyResponse.headers.get(
            "content-type",
          );

        if (
          !nearbyContentType?.includes(
            "application/json",
          )
        ) {
          throw new Error(
            `Nearby API returned ${nearbyResponse.status} instead of JSON.`,
          );
        }

        const nearbyData =
          await nearbyResponse.json();

        console.log(
          "Nearby Places API response:",
          nearbyData,
        );

        if (
          !nearbyResponse.ok ||
          !nearbyData.success
        ) {
          throw new Error(
            nearbyData.error ||
              "Nearby Places API failed.",
          );
        }

        /*
         * Save nearby results.
         */

        setResult({
          ...data,

          nearbyPlaces:
            nearbyData.nearbyPlaces,
        });
      } catch (nearbyErr) {
        console.error(
          "Nearby Places error:",
          nearbyErr,
        );

        setNearbyError(
          nearbyErr instanceof Error
            ? nearbyErr.message
            : "Unable to load nearby places.",
        );

        /*
         * Keep physical address visible
         * even if nearby search fails.
         */

        setResult({
          ...data,
          nearbyPlaces: null,
        });
      } finally {
        setNearbyLoading(false);
      }
    } catch (err) {
      console.error(
        "Location analysis error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while analyzing the website.",
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ============================================================
   * AUTOMATICALLY ANALYZE THE URL FROM WEBSITE ANALYZER
   * ============================================================
   */

  useEffect(() => {
    if (!url.trim()) {
      return;
    }

    analyzeWebsite(url);
  }, [url]);

  /*
   * ============================================================
   * NEARBY DATA
   * ============================================================
   */

  const nearby =
    result?.nearbyPlaces;

  /*
   * ============================================================
   * CATEGORIES
   * ============================================================
   */

  const categories = nearby
    ? [
        [
          "Hospitals & Clinics",
          nearby.hospitals,
        ],

        [
          "Schools & Universities",
          nearby.schools,
        ],

        [
          "Government Offices",
          nearby.governmentOffices,
        ],

        [
          "Government Projects",
          nearby.governmentProjects,
        ],

        [
          "Historical & Heritage",
          nearby.historicalPlaces,
        ],

        [
          "Tourist Attractions",
          nearby.touristAttractions,
        ],

        [
          "Religious Places",
          nearby.religiousPlaces,
        ],

        [
          "Police & Fire Stations",
          nearby.policeFire,
        ],

        [
          "Banks & ATMs",
          nearby.banksAtms,
        ],

        [
          "Parks",
          nearby.parks,
        ],

        [
          "Airports, Rail & Metro",
          nearby.airportsRailMetro,
        ],
      ]
    : [];

  const hasNearbyPlaces =
    categories.some(
      ([, places]) =>
        Array.isArray(places) &&
        places.length > 0,
    );

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <section
      id="location-intelligence"
      aria-labelledby="location-intelligence-heading"
      className="mt-8 scroll-mt-8"
    >
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="p-6 sm:p-8">

          {/* ================================================== */}
          {/* HEADING */}
          {/* ================================================== */}

          <h2
            id="location-intelligence-heading"
            className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
          >
            Location Intelligence
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Location intelligence is automatically generated from
            the website URL you analyzed.
          </p>

          {/* ================================================== */}
          {/* CURRENT URL */}
          {/* ================================================== */}

          {url && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Analyzed Website
              </p>

              <p className="mt-1 break-all text-sm text-slate-300">
                {url}
              </p>
            </div>
          )}

          {/* ================================================== */}
          {/* LOADING */}
          {/* ================================================== */}

          {loading && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />

              <p className="text-sm text-slate-400">
                Analyzing website location...
              </p>
            </div>
          )}

          {/* ================================================== */}
          {/* ERROR */}
          {/* ================================================== */}

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-300">
                {error}
              </p>
            </div>
          )}

          {/* ================================================== */}
          {/* NO PHYSICAL ADDRESS */}
          {/* ================================================== */}

          {!loading &&
            result &&
            !result.hasPhysicalAddress && (
              <div
                role="status"
                className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <MapPin
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    No Physical Address Found
                  </p>

                  <p className="mt-1.5 text-sm leading-6 text-slate-400">
                    This website does not appear to contain
                    a reliable physical address.
                  </p>
                </div>
              </div>
            )}

          {/* ================================================== */}
          {/* PHYSICAL ADDRESS */}
          {/* ================================================== */}

          {!loading &&
            result &&
            result.hasPhysicalAddress &&
            result.location && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">

                {/* TITLE */}

                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                    <MapPin
                      className="h-5 w-5 text-slate-300"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h3 className="font-semibold text-white">
                      Physical Address
                    </h3>

                    <p className="text-xs text-slate-500">
                      Address detected from the website
                    </p>
                  </div>
                </div>

                {/* ORGANIZATION */}

                {result.location
                  .organizationName && (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Organization / Business
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      {
                        result.location
                          .organizationName
                      }
                    </p>
                  </div>
                )}

                {/* FULL ADDRESS */}

                <div className="mt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Full Address
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-200">
                    {
                      result.location
                        .fullAddress
                    }
                  </p>
                </div>

                {/* ADDRESS COMPONENTS */}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  {result.location
                    .streetAddress && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Street Address
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location
                            .streetAddress
                        }
                      </p>
                    </div>
                  )}

                  {result.location
                    .locality && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Locality
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location
                            .locality
                        }
                      </p>
                    </div>
                  )}

                  {result.location.city && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        City
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location.city
                        }
                      </p>
                    </div>
                  )}

                  {result.location
                    .stateProvince && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        State / Province
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location
                            .stateProvince
                        }
                      </p>
                    </div>
                  )}

                  {result.location
                    .country && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Country
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location
                            .country
                        }
                      </p>
                    </div>
                  )}

                  {result.location
                    .postalCode && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Postal / PIN Code
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {
                          result.location
                            .postalCode
                        }
                      </p>
                    </div>
                  )}

                </div>

                {/* SOURCE + CONFIDENCE */}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Source
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {
                        result.location
                          .source
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Confidence
                    </p>

                    <p className="mt-1 text-sm font-medium text-white">
                      {
                        result.location
                          .confidence
                      }
                    </p>
                  </div>

                </div>

                {/* VERIFIED LOCATION */}

                {result.coordinates && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${result.coordinates.latitude}&mlon=${result.coordinates.longitude}#map=17/${result.coordinates.latitude}/${result.coordinates.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300 underline underline-offset-4 hover:text-white"
                  >
                    View verified location

                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* ================================================== */}
                {/* NEARBY PLACES */}
                {/* ================================================== */}

                <div className="mt-8 border-t border-white/10 pt-6">

                  <h3 className="font-semibold text-white">
                    Nearby Places
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Places found within 5 km
                  </p>

                  {/* NEARBY LOADING */}

                  {nearbyLoading && (
                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-300" />

                      <p className="text-sm text-slate-400">
                        Finding nearby places within 5 km...
                      </p>
                    </div>
                  )}

                  {/* NEARBY ERROR */}

                  {!nearbyLoading &&
                    nearbyError && (
                      <div className="mt-5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">

                        <p className="text-sm text-yellow-300">
                          Nearby places could not be loaded.
                        </p>

                        <p className="mt-1 text-xs leading-5 text-yellow-400/70">
                          {nearbyError}
                        </p>

                      </div>
                    )}

                  {/* NO NEARBY DATA */}

                  {!nearbyLoading &&
                    !nearbyError &&
                    !nearby && (
                      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">

                        <p className="text-sm text-slate-400">
                          Nearby places are being prepared.
                        </p>

                      </div>
                    )}

                  {/* NEARBY RESULTS */}

                  {!nearbyLoading &&
                    !nearbyError &&
                    nearby && (
                      <>
                        {!hasNearbyPlaces && (
                          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">

                            <p className="text-sm text-slate-400">
                              No named nearby places were found
                              within 5 km.
                            </p>

                          </div>
                        )}

                        <div className="mt-5 space-y-6">

                          {categories.map(
                            ([category, places]) => {
                              const categoryPlaces =
                                places as NearbyPlace[];

                              if (
                                !categoryPlaces ||
                                categoryPlaces.length ===
                                  0
                              ) {
                                return null;
                              }

                              return (
                                <div
                                  key={
                                    category as string
                                  }
                                >
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    {
                                      category as string
                                    }
                                  </p>

                                  <div className="mt-2 space-y-2">

                                    {categoryPlaces
                                      .slice(0, 5)
                                      .map(
                                        (
                                          place,
                                          index,
                                        ) => (
                                          <div
                                            key={`${place.name}-${index}`}
                                            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                                          >
                                            <div className="flex items-start justify-between gap-3">

                                              <div className="min-w-0">

                                                <p className="text-sm font-medium text-slate-200">
                                                  {
                                                    place.name
                                                  }
                                                </p>

                                                {place.address && (
                                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                                    {
                                                      place.address
                                                    }
                                                  </p>
                                                )}

                                              </div>

                                              <span className="whitespace-nowrap text-xs text-slate-500">
                                                {
                                                  place.distanceKm
                                                }{" "}
                                                km
                                              </span>

                                            </div>
                                          </div>
                                        ),
                                      )}

                                  </div>
                                </div>
                              );
                            },
                          )}

                        </div>
                      </>
                    )}

                </div>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}