import chalk from "chalk";
import cookie from "cookie";
import { SWA_AUTH_CONTEXT_COOKIE, SWA_AUTH_COOKIE } from "../constants";
import { isValueEncryptedAndSigned, validateSignatureAndDecrypt } from "./auth";
import { logger } from "./logger";

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
 * Check if the StaticWebAppsAuthCookie is available.
 * @param cookieValue The cookie value.
 * @returns True if StaticWebAppsAuthCookie is found. False otherwise.
 */
export function validateCookie(cookieValue: string | number | string[]) {
  return validateCookieByName(SWA_AUTH_COOKIE, cookieValue);
}

/**
 *
 * @param cookieValue
 * @returns A ClientPrincipal object.
 */
export function decodeCookie(cookieValue: string): ClientPrincipal | null {
  const stringValue = decodeCookieByName(SWA_AUTH_COOKIE, cookieValue);
  return stringValue ? JSON.parse(stringValue) : null;
}

/**
 * Check if the StaticWebAppsAuthContextCookie is available.
 * @param cookieValue The cookie value.
 * @returns True if StaticWebAppsAuthContextCookie is found. False otherwise.
 */
export function validateAuthContextCookie(cookieValue: string | number | string[]) {
  return validateCookieByName(SWA_AUTH_CONTEXT_COOKIE, cookieValue);
}

/**
 *
 * @param cookieValue
 * @returns StaticWebAppsAuthContextCookie string.
 */
export function decodeAuthContextCookie(cookieValue: string): AuthContext | null {
  const stringValue = decodeCookieByName(SWA_AUTH_CONTEXT_COOKIE, cookieValue);
  return stringValue ? JSON.parse(stringValue) : null;
}

// local functions
function getCookie(cookieName: string, cookies: Record<string, string>) {
  const nonChunkedCookie = cookies[cookieName];

  if (nonChunkedCookie) {
    // prefer the non-chunked cookie if it exists
    return nonChunkedCookie;
  }

  let chunkedCookie = "";
  let chunk = "";
  let index = 0;

  do {
    chunkedCookie = `${chunkedCookie}${chunk}`;
    chunk = cookies[`${cookieName}_${index}`];
    index += 1;
  } while (chunk);

  return chunkedCookie;
}

function validateCookieByName(cookieName: string, cookieValue: string | number | string[]) {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!getCookie(cookieName, cookies);
}

function decodeCookieByName(cookieName: string, cookieValue: string) {
  logger.silly(`decoding ${cookieName} cookie`);
  const cookies = cookie.parse(cookieValue);

  const value = getCookie(cookieName, cookies);

  if (value) {
    const decodedValue = Buffer.from(value, "base64").toString();
    logger.silly(` - ${cookieName} decoded: ${chalk.yellow(decodedValue)}`);

    if (!decodedValue) {
      logger.silly(` - failed to decode '${cookieName}'`);
      return null;
    }

    if (isValueEncryptedAndSigned(decodedValue)) {
      const decryptedValue = validateSignatureAndDecrypt(decodedValue);
      logger.silly(` - ${cookieName} decrypted: ${chalk.yellow(decryptedValue)}`);

      if (!decryptedValue) {
        logger.silly(` - failed to validate and decrypt '${cookieName}'`);
        return null;
      }

      return decryptedValue;
    }

    return decodedValue;
  }
  logger.silly(` - no cookie '${cookieName}' found`);
  return null;
}

export interface CookieOptions extends Omit<cookie.CookieSerializeOptions, "expires"> {
  name: string;
  value: string;
  expires?: string;
}

export class CookiesManager {
  private readonly _chunkSize = 2000;
  private readonly _existingCookies: Record<string, string>;
  private _cookiesToSet: Record<string, CookieOptions> = {};
  private _cookiesToDelete: Record<string, string> = {};

  constructor(requestCookie?: string) {
    this._existingCookies = requestCookie ? cookie.parse(requestCookie) : {};
  }

  private _generateDeleteChunks(name: string, force: boolean /* add the delete cookie even if the corresponding cookie doesn't exist */) {
    const cookies: Record<string, CookieOptions> = {};

    // check for unchunked cookie
    if (force || this._existingCookies[name]) {
      cookies[name] = {
        name: name,
        value: "deleted",
        path: "/",
        httpOnly: false,
        expires: new Date(1).toUTCString(),
      };
    }

    // check for chunked cookie
    let found = true;
    let index = 0;

    while (found) {
      const chunkName = `${name}_${index}`;
      found = !!this._existingCookies[chunkName];
      if (found) {
        cookies[chunkName] = {
          name: chunkName,
          value: "deleted",
          path: "/",
          httpOnly: false,
          expires: new Date(1).toUTCString(),
        };
      }
      index += 1;
    }

    return cookies;
  }

  private _generateChunks(options: CookieOptions): CookieOptions[] {
    const { name, value } = options;

    // pre-populate with cookies for deleting existing chunks
    const cookies: Record<string, CookieOptions> = this._generateDeleteChunks(options.name, false);

    // generate chunks
    if (value !== "deleted") {
      const chunkCount = Math.ceil(value.length / this._chunkSize);

      let index = 0;
      let chunkName = "";

      while (index < chunkCount) {
        const position = index * this._chunkSize;
        const chunk = value.substring(position, position + this._chunkSize);

        chunkName = `${name}_${index}`;

        cookies[chunkName] = {
          ...options,
          name: chunkName,
          value: chunk,
        };

        index += 1;
      }
    }

    return Object.values(cookies);
  }

  public addCookieToSet(options: CookieOptions): void {
    this._cookiesToSet[options.name.toLowerCase()] = options;
  }

  public addCookieToDelete(name: string): void {
    this._cookiesToDelete[name.toLowerCase()] = name;
  }

  public getCookies(): CookieOptions[] {
    const allCookies: CookieOptions[] = [];
    Object.values(this._cookiesToDelete).forEach((cookieName) => {
      const chunks = this._generateDeleteChunks(cookieName, true);
      allCookies.push(...Object.values(chunks));
    });
    Object.values(this._cookiesToSet).forEach((cookie) => {
      const chunks = this._generateChunks(cookie);
      allCookies.push(...chunks);
    });
    return allCookies;
  }
}
