import cookie from "cookie";
export const validateCookie = (cookieValue: string) => {
  if (typeof cookieValue !== "string") {
    throw Error(`TypeError: cookie value must be a string.`);
  }

  const cookies = cookie.parse(cookieValue);
  return !!cookies.StaticWebAppsAuthCookie;
};

export const serializeCookie = (cookieName: string, cookieValue: string, options: any) => {
  return cookie.serialize(cookieName, cookieValue, options);
};

export const decodeCookie = (cookieValue: any): ClientPrincipal | null => {
  const cookies = cookie.parse(cookieValue);
  if (cookies.StaticWebAppsAuthCookie) {
    const decodedValue = Buffer.from(cookies.StaticWebAppsAuthCookie, "base64").toString();
    return JSON.parse(decodedValue);
  }
  return null;
};
