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
