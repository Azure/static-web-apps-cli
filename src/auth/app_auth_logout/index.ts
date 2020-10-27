import { AzureFunction, HttpRequest } from "@azure/functions";
import { response, validateCookie } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger: AzureFunction = function (context, req: HttpRequest) {
  const cookie = req.headers.cookie;

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
      location: `${SWA_EMU_AUTH_URI}/.redirect/logout?hostName=localhost`,
    },
  });
};

export default httpTrigger;
