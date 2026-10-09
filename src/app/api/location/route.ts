import { NextResponse } from "next/server";

import { fetchWebsitePages } from "@/lib/location/fetchWebsite";

import {
  extractAddressesFromWebsite,
} from "@/lib/location/address";

import {
  geocodeLocation,
} from "@/lib/location/geocode";

import {
  analyzeWebsiteWithAI,
} from "@/lib/location/aiWebsiteAnalysis";

import {
  createAddressSuggestions,
} from "@/lib/location/addressSuggestions";


export async function POST(
  request: Request
) {
  try {

    /* 
     * ==========================================
     * LOCATION INTELLIGENCE
     * ==========================================
     */

    const body =
      await request.json();

    const websiteUrl =
      body?.url;

    if (
      !websiteUrl ||
      typeof websiteUrl !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Website URL is required.",
        },
        {
          status: 400,
        }
      );
    }


    console.log(
      "===================================="
    );

    console.log(
      "Location Intelligence"
    );

    console.log(
      "Website:",
      websiteUrl
    );

    console.log(
      "===================================="
    );


    /*
     * ==========================================
     * STEP 1
     * Fetch website pages
     * ==========================================
     */

    const pages =
      await fetchWebsitePages(
        websiteUrl.trim()
      );


    /*
     * ==========================================
     * STEP 1A
     * AI WEBSITE ANALYSIS
     *
     * This is completely separate from
     * physical-address extraction.
     *
     * No company names or website names
     * are hardcoded.
     * ==========================================
     */

    let aiAnalysis = null;
    let addressSuggestions = null;

    try {

      aiAnalysis =
        await analyzeWebsiteWithAI(
          pages || []
        );

      addressSuggestions =
        createAddressSuggestions(
          aiAnalysis
        );

      console.log(
        "AI Website Analysis:",
        aiAnalysis
      );

    } catch (error) {

      console.warn(
        "AI website analysis failed:",
        error
      );
    }


    /*
     * ==========================================
     * NO WEBSITE CONTENT
     * ==========================================
     */

    if (
      !pages ||
      pages.length === 0
    ) {

      return NextResponse.json({
        success: true,

        hasPhysicalAddress:
          false,

        locations: [],

        nearbyPlaces: null,

        websiteAnalysis:
          aiAnalysis,

        suggestions:
          addressSuggestions
            ?.suggestions || [],
      });

    }


    /*
     * ==========================================
     * STEP 2
     * Extract physical addresses
     * ==========================================
     */

    const allLocations: any[] =
      [];


    for (
      const page of pages
    ) {

      try {

        console.log(
          "Extracting address from:",
          page.url
        );


        const extracted =
          await extractAddressesFromWebsite(
            page.url,
            page.html
          );


        if (
          extracted?.locations &&
          Array.isArray(
            extracted.locations
          )
        ) {

          allLocations.push(
            ...extracted.locations
          );

        }

      } catch (error) {

        console.warn(
          "Address extraction failed for:",
          page.url,
          error
        );

      }

    }


    /*
     * ==========================================
     * STEP 3
     * Remove duplicate addresses
     * ==========================================
     */

    const uniqueLocations =
      allLocations.filter(
        (
          location,
          index,
          array
        ) => {

          const key = [
            location.fullAddress,
            location.city,
            location.stateProvince,
            location.country,
            location.postalCode,
          ]
            .filter(Boolean)
            .join("|")
            .toLowerCase()
            .trim();


          return (
            array.findIndex(
              (item) => {

                const itemKey = [
                  item.fullAddress,
                  item.city,
                  item.stateProvince,
                  item.country,
                  item.postalCode,
                ]
                  .filter(Boolean)
                  .join("|")
                  .toLowerCase()
                  .trim();


                return (
                  itemKey === key
                );

              }
            ) === index
          );

        }
      );


    /*
     * ==========================================
     * NO PHYSICAL ADDRESS
     * ==========================================
     */

    if (
      uniqueLocations.length === 0
    ) {

      console.log(
        "No physical address found."
      );


      return NextResponse.json({
        success: true,

        hasPhysicalAddress:
          false,

        message:
          "No physical address could be reliably identified from the analyzed website.",

        locations: [],

        location: null,

        coordinates: null,

        nearbyPlaces: null,

        /*
         * AI explanation
         */

        websiteAnalysis:
          aiAnalysis,

        /*
         * Dynamically generated
         * website-type suggestions
         */

        suggestions:
          addressSuggestions
            ?.suggestions || [],
      });

    }


    /*
     * ==========================================
     * STEP 4
     * Mark primary location
     * ==========================================
     */

    const locations =
      uniqueLocations.map(
        (
          location,
          index
        ) => ({
          ...location,

          isPrimary:
            index === 0,
        })
      );


    const primaryLocation =
      locations[0];


    console.log(
      "Primary physical address:",
      primaryLocation
    );


    /*
     * ==========================================
     * STEP 5
     * Geocode the PHYSICAL ADDRESS
     *
     * Coordinates are used internally only.
     * They are NOT displayed as address data.
     * ==========================================
     */

    const coordinates =
      await geocodeLocation(
        primaryLocation
      );


    /*
     * We found an address but could not
     * reliably convert it to coordinates.
     *
     * Do NOT use random coordinates.
     */

    if (!coordinates) {

      console.warn(
        "Physical address found, but reliable coordinates could not be determined."
      );


      return NextResponse.json({
        success: true,

        hasPhysicalAddress:
          true,

        location: {
          ...primaryLocation,

          isPrimary: true,
        },

        locations,

        coordinates: null,

        nearbyPlaces: null,

        /*
         * AI analysis is still available,
         * but it does NOT determine the address.
         */

        websiteAnalysis:
          aiAnalysis,

        suggestions:
          addressSuggestions
            ?.suggestions || [],
      });

    }


    /*
     * ==========================================
     * STEP 6
     * Return address + INTERNAL coordinates
     * ==========================================
     */

    console.log(
      "Verified coordinates:",
      coordinates
    );


    return NextResponse.json({
      success: true,

      hasPhysicalAddress:
        true,


      location: {
        ...primaryLocation,

        isPrimary: true,
      },


      locations,


      coordinates: {
        latitude:
          coordinates.latitude,

        longitude:
          coordinates.longitude,

        displayName:
          coordinates.displayName,
      },


      nearbyPlaces: null,


      /*
       * AI analysis is returned as
       * additional information.
       *
       * It does NOT control the
       * physical address.
       */

      websiteAnalysis:
        aiAnalysis,

      suggestions:
        addressSuggestions
          ?.suggestions || [],
    });


  } catch (error) {

    console.error(
      "Location API error:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze the website.",
      },
      {
        status: 500,
      }
    );

  }
}