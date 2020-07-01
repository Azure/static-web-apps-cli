const cookie = require("cookie");
const { default: fetch } = require("node-fetch");

module.exports.response = ({ context, status, headers, cookies, body = "" }) => {
  let location;
  if (headers) {
    ({ location } = headers);
    headers = {
      ...headers,
      location,
      // location: null
    };
  }

  body = body || null;
  if (process.env.DEBUG) {
    body =
      body ||
      JSON.stringify(
        {
          location,
          debug: {
            response: {
              cookies: {
                ...cookies,
              },
              headers: {
                ...headers,
              },
            },
            context: {
              ...context.bindingData,
            },
          },
        },
        null,
        2
      );
  }

  const res = {
    status,
    headers,
    cookies,
    headers: {
      status,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  };
  return res;
};

module.exports.validateCookie = (cookieValue) => {
  const cookies = cookie.parse(cookieValue);

  if (cookies.StaticWebAppsAuthCookie) {
    return cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie;
  }

  return false;
};

module.exports.ɵɵUseGithubDevToken = async () => {
  console.log("!!!! Notice: You are using a dev GitHub token. You should create and use your own!");
  console.log("!!!! Read https://docs.github.com/en/developers/apps/building-oauth-apps");
  const swaTokens = `https://gist.githubusercontent.com/manekinekko/7fbfc79a85b0f1f312715f1beda26236/raw/740c51aac5b1fb970e69408067a49907485d1e31/swa-emu.json`;
  const swaTokensResponse = await fetch(swaTokens);
  const token = await swaTokensResponse.json();
  return token.github;
};
