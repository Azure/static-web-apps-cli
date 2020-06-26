const { response } = require("../utils");
const { default: fetch } = require("node-fetch");

module.exports = async function (context, req) {
  let { state, code } = req.query;

  state = decodeURIComponent(state);

  const client_id = process.env.GITHUB_CLIENT_ID;
  const client_secret = process.env.GITHUB_CLIENT_SECRET;
  const oauthUri = `https://github.com/login/oauth/access_token?client_id=${client_id}&client_secret=${client_secret}&code=${code}&state=${state}`;
  const githubOauthResponse = await fetch(oauthUri, {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  });

  const token = await githubOauthResponse.json();

  const location = "http://localhost:4242/.auth/login/done";
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "Nonce",
        value: "deleted",
        path: "/",
        expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT'),
      },
      {
        name: "RedirectCount",
        value: "deleted",
        path: "/",
        expires: new Date('Thu, 01 Jan 1970 00:00:00 GMT'),
      },
      {
        name: "AppServiceAuthSession",
        value: "UUUUU",
        path: "/",
        secure: true,
        HttpOnly: true,
        SameSite: "None",
      },
    ],
    headers: {
      location,
      token
    },
  });
};
