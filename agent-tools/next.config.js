/** @type {import('next').NextConfig} */

// Who is allowed to frame this app. GoHighLevel serves the Krest Marketing App
// from a white-labelled domain, so keep this in an env var rather than
// hard-coding app.gohighlevel.com.
const frameAncestors = (process.env.GHL_FRAME_ANCESTORS ||
  "https://app.gohighlevel.com https://*.gohighlevel.com https://*.leadconnectorhq.com https://*.msgsndr.com")
  .trim();

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
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
