const { response } = require("../src/utils");
const SWA_EMU_HOST = "//localhost:" + process.env.SWA_EMU_PORT || `//localhost`;

module.exports = async function (context, req) {
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticSitesAuthCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
    ],
    headers: {
      location: SWA_EMU_HOST,
    },
  });
};
