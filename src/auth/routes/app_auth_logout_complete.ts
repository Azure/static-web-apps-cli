
import { response } from "../../utils";
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

const httpTrigger = async function (context: Context, req: ServerRequest) {
  const { post_logout_redirect_uri } = req.query;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthCookie",
        value: "deleted",
        path: "/",
        // secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1).toUTCString(),
      },
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        // secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1).toUTCString(),
      },
      {
        name: "StaticWebAppsAuthCookie__PROVIDER",
        value: "deleted",
        path: "/",
        // secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1).toUTCString(),
      },
    ],
    headers: {
      location: `${SWA_EMU_HOST}${post_logout_redirect_uri}`,
    },
  });
};

export default httpTrigger;
