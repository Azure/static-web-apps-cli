import { IncomingMessage } from "node:http";
import { CookiesManager } from "../../../core/utils/cookie.js";
import { response } from "../../../core/utils/net.js";
import { promises as fs } from "node:fs";
import path from "node:path";

const httpTrigger = async function (context: Context, request: IncomingMessage) {
  const body = await fs.readFile(path.join(__dirname, "..", "..", "..", "public", "auth.html"), "utf-8");

  const cookiesManager = new CookiesManager(request.headers.cookie);
  cookiesManager.addCookieToDelete("StaticWebAppsAuthContextCookie");

  context.res = response({
    context,
    status: 200,
    headers: {
      "Content-Type": "text/html",
      status: 200,
    },
    body: injectOriginalUrlMetaTags(body, request.url),
  });
};

function injectOriginalUrlMetaTags(body: string, url?: string): string {
  // pass original URL to page in case or rewrite
  if (url) {
    const [path, search] = url.split("?");
    const metaTags = `<meta name="swa:originalPath" content="${path}">` + (search ? `<meta name="swa:originalSearch" content="?${search}">` : "");
    return body.replace(/(<\/head>)/i, `${metaTags}$1`);
  } else {
    return body;
  }
}

export default httpTrigger;
