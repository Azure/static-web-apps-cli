import http from "http";
import { response } from "../../core";

const httpTrigger = async function (context: Context, req: http.IncomingMessage) {
  const host = req?.headers?.host;
  if (!host) {
    context.res = response({
      context,
      status: 500,
    });
    return;
  }

  const uri = `${process.env.SWA_CLI_APP_SSL === "true" ? "https" : "http"}://${host}`;
  const query = new URL(req?.url || "", uri).searchParams;
  const location = `${uri}${query.get("post_logout_redirect_uri") || "/"}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthCookie",
        value: "deleted",
        path: "/",
        HttpOnly: false,
        expires: new Date(1).toUTCString(),
      },
    ],
    headers: {
      Location: location,
    },
  });
};

export default httpTrigger;
