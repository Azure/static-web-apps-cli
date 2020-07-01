const { response, ɵɵUseGithubDevToken } = require("../src/utils");
const { default: fetch } = require("node-fetch");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `//localhost:4242`;

module.exports = async function (context, req) {
  let { state, code } = req.query;
  state = decodeURIComponent(state);

  let client_id = process.env.GITHUB_CLIENT_ID;
  let client_secret = process.env.GITHUB_CLIENT_SECRET;

  //**** GITHUB NOTICE */
  if (!client_id || !client_secret) {
    ({ client_id, client_secret } = await ɵɵUseGithubDevToken());
  }
  //**** GITHUB NOTICE */

  const oauthUri = `https://github.com/login/oauth/access_token?client_id=${client_id}&client_secret=${client_secret}&code=${code}&state=${state}`;
  const githubOauthResponse = await fetch(oauthUri, {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  });

  const token = await githubOauthResponse.json();
  const location = `${SWA_EMU_AUTH_URI}/.auth/login/done`;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "Nonce",
        value: "deleted",
        path: "/",
        expires: new Date(1970),
      },
      {
        name: "RedirectCount",
        value: "deleted",
        path: "/",
        expires: new Date(1970),
      },
      {
        name: "AppServiceAuthSession",
        value: process.env.AppServiceAuthSession,
        path: "/",
        secure: false,
        HttpOnly: false,
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};
