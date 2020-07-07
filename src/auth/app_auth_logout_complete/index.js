const { response } = require("../../utils");
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

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
