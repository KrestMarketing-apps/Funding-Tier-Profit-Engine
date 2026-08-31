/**
 * The app is served under a sub-path of ai.fundingtier.com, so every URL it
 * emits has to carry the prefix. Next adds it to its own routing, but not to
 * things we write by hand: <img src>, <link href>, fetch() targets, form
 * actions and Location headers. Those all go through here.
 *
 * Keep BASE_PATH in sync with basePath in next.config.js — that file is
 * CommonJS and loads before TypeScript, so it cannot import this one.
 */
/** Name used in access log entries. */
export const TOOL_NAME = "Profit Engine";

export const BASE_PATH = "/profit-engine";

/** Prefix an app-absolute path: p("/login") -> "/profit-engine/login" */
export function p(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * The origin to build redirects against.
 *
 * This app is reached through a Vercel rewrite from ai.fundingtier.com, which
 * proxies — so the request arrives bearing this deployment's own hostname, and
 * a redirect built from req.url would drop the user onto *.vercel.app halfway
 * through signing in. Relative Location headers are not an option either:
 * Next parses middleware redirects as absolute URLs and throws on a bare path.
 *
 * So the public origin is stated explicitly. Set PUBLIC_ORIGIN to
 * https://ai.fundingtier.com in Vercel. Unset, it falls back to the request's
 * own origin, which is correct when the deployment is opened directly.
 */
export function origin(requestOrigin: string): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim().replace(/\/+$/, "");
  return configured || requestOrigin;
}

/** Absolute URL on the public origin, with the sub-path applied. */
export function url(requestOrigin: string, path: string, search = ""): string {
  return `${origin(requestOrigin)}${p(path)}${search}`;
}
