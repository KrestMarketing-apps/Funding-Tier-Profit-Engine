/** @type {import('next').NextConfig} */

// Served at https://ai.fundingtier.com/profit-engine via a rewrite in the
// funding-tier-ai-router project. Keep in sync with lib/paths.ts.
const BASE_PATH = "/profit-engine";

// Who is allowed to frame this app. GoHighLevel serves the Krest Marketing App
// from a white-labelled domain, so keep this in an env var rather than
// hard-coding app.gohighlevel.com.
const frameAncestors = (process.env.GHL_FRAME_ANCESTORS ||
  "https://app.gohighlevel.com https://*.gohighlevel.com https://*.leadconnectorhq.com https://*.msgsndr.com")
  .trim();

const nextConfig = {
  basePath: BASE_PATH,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // The session cookie is SameSite=None so it survives the iframe;
          // this is what stops any other site from framing the app and using it.
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${frameAncestors};` },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
