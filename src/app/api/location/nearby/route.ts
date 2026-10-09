import { NextResponse } from "next/server";

import { findNearbyPlaces } from "@/lib/location/nearbyPlaces";

import {
  findGovernmentProjects,
} from "@/lib/location/governmentProjects";


export async function POST(
  request: Request
) {
  try {

    const body =
      await request.json();


    /*
     * Get coordinates
     */

    const latitude =
      Number(body?.latitude);

    const longitude =
      Number(body?.longitude);


    /*
     * Validate coordinates
     */

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "Valid coordinates are required.",
        },

        {
          status: 400,
        }
      );
    }


    /*
     * Organization name
     *
     * This is used by nearbyPlaces.ts
     * to prevent the detected organization
     * itself from appearing as a nearby place.
     */

    const organizationName =
      typeof body?.organizationName ===
      "string"
        ? body.organizationName.trim()
        : null;


    /*
     * ========================================================
     * NORMAL NEARBY PLACES
     * ========================================================
     *
     * Always search within 5 km.
     */

    const nearbyPlaces =
      await findNearbyPlaces(
        latitude,
        longitude,
        5,
        organizationName
      );


    /*
     * ========================================================
     * GOVERNMENT PROJECTS
     * ========================================================
     *
     * Government projects are handled separately because
     * a normal government office is NOT a government project.
     *
     * Example:
     *
     * Government Office  -> NOT a project
     * Metro construction -> possible project
     * Road widening      -> possible project
     * Flyover project    -> possible project
     *
     */

    const governmentProjects =
      await findGovernmentProjects(
        latitude,
        longitude
      );


    /*
     * ========================================================
     * FINAL RESPONSE
     * ========================================================
     *
     * Keep every existing nearby-place category.
     *
     * Add governmentProjects separately.
     */

    return NextResponse.json({

      success: true,

      nearbyPlaces: {

        ...nearbyPlaces,

        governmentProjects,

      },

    });

  } catch (error) {

    console.error(
      "Nearby Places API error:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          "Failed to find nearby places.",
      },

      {
        status: 500,
      }
    );
  }
}