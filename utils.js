const cookie = require('cookie');

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

  const res = {
    status,
    headers,
    cookies,
    headers: {
      status,
      "Content-Type": "application/json",
      ...headers,
    },
    body:
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
      ),
  };
  return res;
};


module.exports.validateCookie = (cookieValue) => {
  const cookies = cookie.parse(cookieValue);
  console.log(JSON.stringify(cookies));

  if (cookies.StaticWebAppsAuthCookie) {
    console.log(cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie);
    return cookies.StaticWebAppsAuthCookie === process.env.StaticWebAppsAuthCookie;
  }

 return false;
}