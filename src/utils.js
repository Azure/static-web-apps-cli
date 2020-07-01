const cookie = require("cookie");

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
