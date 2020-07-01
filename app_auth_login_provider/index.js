const { response } = require("../src/utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `//localhost:4242`;

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const location = `${SWA_EMU_AUTH_URI}/.redirect/${provider}?hostName=localhost&staticWebAppsAuthNonce=${context.invocationId}`;

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
      location,
    },
  });
};
