import chalk from "chalk";
import cookie from "cookie";
import { NONCE, SWA_AUTH_COOKIE } from "../constants";
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
  logger.silly(`decoding cookie`);
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
 * Check if the Nonce is available.
 * @param cookieValue The cookie value.
 * @returns True if Nonce is found. False otherwise.
 */
export function validateNonceCookie(cookieValue: string | number | string[]) {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies[NONCE];
}

/**
 *
 * @param cookieValue
 * @returns Nonce string.
 */
export function decodeNonceCookie(cookieValue: string): string | null {
  logger.silly(`decoding nonce cookie`);
  const cookies = cookie.parse(cookieValue);
  if (cookies[NONCE]) {
    const decodedValue = Buffer.from(cookies[NONCE], "base64").toString();
    logger.silly(` - Nonce: ${chalk.yellow(decodedValue)}`);
    return decodedValue;
  }
  logger.silly(` - no cookie 'Nonce' found`);
  return null;
}
