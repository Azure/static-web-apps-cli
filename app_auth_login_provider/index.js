const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const location = `http://127.0.0.1:4242/.redirect/${provider}?hostName=localhost&staticWebAppsAuthNonce=${context.invocationId}`;
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
        domain: "127.0.0.1",
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};
