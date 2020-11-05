import { AzureFunction, HttpRequest } from "@azure/functions";
import { response, validateCookie } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = async function (context, req: HttpRequest) {
  const cookie = req.headers.cookie;
  const { post_logout_redirect_uri } = req.query;

  if (!cookie || !validateCookie(cookie)) {
    context.res = response({
      context,
      status: 401,
    });
  }

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: process.env.StaticWebAppsAuthContextCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "None",
      },
    ],
    headers: {
      location: `${SWA_EMU_AUTH_URI}/.redirect/logout?hostName=localhost&post_logout_redirect_uri=${post_logout_redirect_uri}`,
    },
  });
};

export default httpTrigger;
