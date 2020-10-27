const { response } = require("../../utils");
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri = "" } = req.query;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthCookie",
        value: process.env.StaticWebAppsAuthCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "Strict",
      },
    ],
    headers: {
      location: `${SWA_EMU_HOST}/${post_login_redirect_uri}`,
    },
  });
};
