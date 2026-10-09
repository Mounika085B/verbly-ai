export interface WebsitePage {
  url: string;
  html: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

/*
 * Generic page keywords.
 *
 * These help the crawler find pages that may contain
 * physical addresses on different types of websites.
 */
const PAGE_KEYWORDS = [
  "contact",
  "contact-us",
  "contactus",

  "about",
  "about-us",

  "location",
  "locations",

  "find-us",
  "findus",

  "visit-us",
  "visit",

  "office",
  "offices",

  "head-office",
  "headoffice",
  "head-office",

  "registered-office",
  "registeredoffice",

  "corporate-office",
  "corporateoffice",

  "corporate",
  "company",

  "branch",
  "branches",

  "address",
  "addresses",

  "reach-us",
  "reachus",

  "get-in-touch",
  "getintouch",

  "campus",
  "campuses",

  "directions",
  "where-we-are",
  "where-we-are",

  "visit",
];

/*
 * Create alternative versions of the entered URL.
 *
 * Example:
 * https://www.example.com
 *
 * becomes:
 * https://www.example.com
 * https://example.com
 */
function getAlternativeUrls(url: string): string[] {
  const urls: string[] = [];

  try {
    const parsed = new URL(url);

    urls.push(parsed.toString());

    const hostname = parsed.hostname;

    if (hostname.startsWith("www.")) {
      const withoutWww = hostname.substring(4);

      urls.push(
        `${parsed.protocol}//${withoutWww}${parsed.pathname}${parsed.search}`
      );
    } else {
      urls.push(
        `${parsed.protocol}//www.${hostname}${parsed.pathname}${parsed.search}`
      );
    }
  } catch {
    return [url];
  }

  return [...new Set(urls)];
}

/*
 * Fetch one page.
 */
async function fetchPage(
  url: string
): Promise<string | null> {
  try {
    console.log("Fetching:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml",
      },

      redirect: "follow",

      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(
        `Failed ${url}: HTTP ${response.status}`
      );

      return null;
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(
      `Error fetching ${url}:`,
      error
    );

    return null;
  }
}

/*
 * Find useful links from the homepage.
 */
function getRelevantLinks(
  homepageUrl: string,
  html: string
): string[] {
  const links: string[] = [];

  try {
    const baseUrl = new URL(homepageUrl);

    /*
     * Simple HTML link extraction.
     *
     * We don't need another package just for this.
     */
    const hrefRegex =
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

    let match: RegExpExecArray | null;

    while (
      (match = hrefRegex.exec(html)) !== null
    ) {
      const href = match[1];

      if (!href) {
        continue;
      }

      /*
       * Ignore things that are not normal pages.
       */
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        continue;
      }

      try {
        const absoluteUrl =
          new URL(href, baseUrl);

        /*
         * Only visit the same website/domain.
         */
        if (
          absoluteUrl.hostname !==
            baseUrl.hostname &&
          absoluteUrl.hostname.replace(
            /^www\./,
            ""
          ) !==
            baseUrl.hostname.replace(
              /^www\./,
              ""
            )
        ) {
          continue;
        }

        /*
         * Only HTTP/HTTPS.
         */
        if (
          absoluteUrl.protocol !== "http:" &&
          absoluteUrl.protocol !== "https:"
        ) {
          continue;
        }

        const pathAndQuery =
          `${absoluteUrl.pathname}${absoluteUrl.search}`.toLowerCase();

        /*
         * Check whether this link looks relevant.
         */
        const isRelevant =
          PAGE_KEYWORDS.some(
            (keyword) =>
              pathAndQuery.includes(keyword)
          );

        if (!isRelevant) {
          continue;
        }

        /*
         * Remove hash.
         */
        absoluteUrl.hash = "";

        links.push(
          absoluteUrl.toString()
        );
      } catch {
        // Ignore invalid URLs
      }
    }
  } catch {
    return [];
  }

  return [...new Set(links)];
}

/*
 * Fetch the website homepage and useful
 * address-related pages.
 */
export async function fetchWebsitePages(
  websiteUrl: string
): Promise<WebsitePage[]> {
  console.log(
    "Starting website fetch:",
    websiteUrl
  );

  const alternativeUrls =
    getAlternativeUrls(websiteUrl);

  let homepageUrl: string | null = null;
  let homepageHtml: string | null = null;

  /*
   * Try the entered URL and www/non-www alternative.
   */
  for (const url of alternativeUrls) {
    const html = await fetchPage(url);

    if (html) {
      homepageUrl = url;
      homepageHtml = html;
      break;
    }
  }

  if (!homepageUrl || !homepageHtml) {
    console.log(
      "Unable to fetch homepage."
    );

    return [];
  }

  const pages: WebsitePage[] = [];

  /*
   * Always include homepage.
   */
  pages.push({
    url: homepageUrl,
    html: homepageHtml,
  });

  /*
   * Find useful pages such as:
   *
   * /contact
   * /about
   * /corporate
   * /head-office
   * /campus
   * /locations
   */
  const relevantLinks =
    getRelevantLinks(
      homepageUrl,
      homepageHtml
    );

  console.log(
    "Relevant links found:",
    relevantLinks.length
  );

  /*
   * Don't crawl an unlimited number of pages.
   */
  const linksToFetch =
    relevantLinks.slice(0, 15);

  for (const link of linksToFetch) {
    /*
     * Avoid fetching homepage again.
     */
    if (link === homepageUrl) {
      continue;
    }

    const html =
      await fetchPage(link);

    if (!html) {
      continue;
    }

    pages.push({
      url: link,
      html,
    });
  }

  console.log(
    "Total pages fetched:",
    pages.length
  );

  return pages;
}