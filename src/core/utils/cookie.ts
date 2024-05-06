import chalk from "chalk";
import cookie from "cookie";
import { SWA_AUTH_CONTEXT_COOKIE, SWA_AUTH_COOKIE } from "../constants";
import { logger } from "./logger";

/**
 * Check if the StaticWebAppsAuthCookie is available.
 * @param cookieValue The cookie value.
 * @returns True if StaticWebAppsAuthCookie is found. False otherwise.
 */
export function validateCookie(cookieValue: string | number | string[]) {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies[SWA_AUTH_COOKIE];
}

/**
 * Serialize a cookie name-value pair into a string that can be used in Set-Cookie header.
 * @param cookieName The name for the cookie.
 * @param cookieValue The value to set the cookie to.
 * @param options An object containing serialization options
 * @throws {TypeError} when maxAge options is invalid.
 * @returns The serialized value.
 */
export function serializeCookie(cookieName: string, cookieValue: string, options: any) {
  return cookie.serialize(cookieName, cookieValue, options);
}

/**
 *
 * @param cookieValue
 * @returns A ClientPrincipal object.
 */
export function decodeCookie(cookieValue: string): ClientPrincipal | null {
  logger.silly(`decoding StaticWebAppsAuthCookie cookie`);
  const cookies = cookie.parse(cookieValue);
  if (cookies[SWA_AUTH_COOKIE]) {
    const decodedValue = Buffer.from(cookies[SWA_AUTH_COOKIE], "base64").toString();
    logger.silly(` - StaticWebAppsAuthCookie: ${chalk.yellow(decodedValue)}`);
    return JSON.parse(decodedValue);
  }
  logger.silly(` - no cookie 'StaticWebAppsAuthCookie' found`);
  return null;
}

/**
 * Check if the StaticWebAppsAuthContextCookie is available.
 * @param cookieValue The cookie value.
 * @returns True if StaticWebAppsAuthContextCookie is found. False otherwise.
 */
export function validateAuthContextCookie(cookieValue: string | number | string[]) {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies[SWA_AUTH_CONTEXT_COOKIE];
}

/**
 *
 * @param cookieValue
 * @returns StaticWebAppsAuthContextCookie string.
 */
export function decodeAuthContextCookie(cookieValue: string): AuthContext | null {
  logger.silly(`decoding StaticWebAppsAuthContextCookie cookie`);
  const cookies = cookie.parse(cookieValue);
  if (cookies[SWA_AUTH_CONTEXT_COOKIE]) {
    const decodedValue = Buffer.from(cookies[SWA_AUTH_CONTEXT_COOKIE], "base64").toString();
    logger.silly(` - StaticWebAppsAuthContextCookie: ${chalk.yellow(decodedValue)}`);
    return JSON.parse(decodedValue);
  }
  logger.silly(` - no cookie 'StaticWebAppsAuthContextCookie' found`);
  return null;
}
