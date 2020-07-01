const { response, validateCookie } = require("../src/utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

module.exports = async function (context, req) {
  const cookie = req.headers.cookie;
  const { post_logout_redirect_uri } = req.query;

  if (!cookie || !validateCookie(cookie)) {
    return response({
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
