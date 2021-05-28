import chalk from "chalk";
import cookie from "cookie";
import { logger } from "./logger";
export function validateCookie(cookieValue: string) {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string.`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies.StaticWebAppsAuthCookie;
}

export function serializeCookie(cookieName: string, cookieValue: string, options: any) {
  return cookie.serialize(cookieName, cookieValue, options);
}

export function decodeCookie(cookieValue: any): ClientPrincipal | null {
  logger.silly(`decoding cookie...`);
  const cookies = cookie.parse(cookieValue);
  if (cookies.StaticWebAppsAuthCookie) {
    const decodedValue = Buffer.from(cookies.StaticWebAppsAuthCookie, "base64").toString();
    logger.silly(` - StaticWebAppsAuthCookie: ${chalk.yellow(decodedValue)}.`);
    return JSON.parse(decodedValue);
  }
  logger.silly(` - no cookie 'StaticWebAppsAuthCookie' found.`);
  return null;
}
