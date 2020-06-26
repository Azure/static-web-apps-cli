const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const location = `http://localhost:4242/.redirect/${provider}?hostName=localhost&staticWebAppsAuthNonce=${context.invocationId}`;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "KKK",
        path: "/",
        secure: true,
        HttpOnly: true,
        domain: "localhost",
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};
