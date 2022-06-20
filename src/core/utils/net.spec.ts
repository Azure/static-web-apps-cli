jest.mock("../constants", () => {});
import { logger } from "./logger";
import { address, hostnameToIpAdress, parsePort, parseUrl, response } from "./net";

describe("net utilities", () => {
  describe("response()", () => {
    it("context = null", () => {
      expect(() => {
        response({
          context: null,
        });
      }).toThrow();
    });
    it("context.bindingData = {foo:bar}", () => {
      expect(
        response({
          status: 200,
          context: {
            bindingData: {
              foo: "bar",
            },
          },
        })
      ).toEqual({
        body: null,
        cookies: undefined,
        headers: { "Content-Type": "application/json", status: 200 },
        status: 200,
      });
    });

    it("status = null", () => {
      expect(() => {
        response({
          context: {
            bindingData: {},
          },
          status: null,
        });
      }).toThrow(/TypeError/);
    });

    it("status = 200", () => {
      const res = response({
        context: {
          bindingData: {},
        },
        status: 200,
      });
      expect(res.status).toBe(200);
      expect(res.headers.status).toBe(200);
    });

    it("body = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: null,
      });
      expect(res.body).toBe(null);
    });

    it("body = {foo:bar}", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: {
          foo: "bar",
        },
      });
      expect(typeof res.body).toBe("object");
      expect(res.body.foo).toBeDefined();
      expect(res.body.foo).toBe("bar");
    });

    it("body = {foo:bar} (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: {
          foo: "bar",
        },
      });
      expect(typeof res.body).toBe("object");
      expect(res.body.foo).toBeDefined();
      expect(res.body.foo).toBe("bar");
    });

    it("headers = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: null,
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = null (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: null,
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { foo: bar }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          foo: "bar",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.foo).toBe("bar");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { foo: bar } (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          foo: "bar",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.foo).toBe("bar");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: null }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: null,
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe(null);
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: null } (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: null,
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe(null);
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: 'wassim.dev' }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: "wassim.dev",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe("wassim.dev");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("cookies = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        cookies: null,
      });

      expect(res.cookies).toBe(null);
    });

    it("cookies = { foo:bar }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        cookies: {
          foo: "bar",
        },
      });
      expect(res.cookies).toBeDefined();
      expect(res.cookies!.foo).toBe("bar");
    });
  });

  describe("parsePort()", () => {
    const mockLoggerError = jest.spyOn(logger, "error").mockImplementation(() => {
      return undefined as never;
    });

    it("Ports below 1024 should be invalid", () => {
      parsePort("0");
      expect(mockLoggerError).toBeCalled();
    });
    it("Ports above 49151 should be invalid", () => {
      parsePort("98765");
      expect(mockLoggerError).toBeCalled();
    });
    it("Non-number ports should be invalid", () => {
      parsePort("not a number");
      expect(mockLoggerError).toBeCalled();
    });
    it("Ports between 1024 - 49151 should be valid", () => {
      const port = parsePort("1984");
      expect(port).toBe(1984);
    });
  });

  describe("address()", () => {
    it("should throw for malformed URI", () => {
      expect(() => address("", undefined)).toThrowError(/Host value is not set/);
      expect(() => address("", 80)).toThrowError(/Host value is not set/);
      expect(() => address("¬˚˜∆˙¨√√†®ç†®∂œƒçƒ∂ß®´ß`®´£¢´®¨¥†øˆ¨ø(*&*ˆ%&ˆ%$#%@!")).toThrowError(/malformed/);
      expect(() => address("123.45.43.56234", undefined)).toThrowError(/malformed/);
    });

    it("should handle valid URIs", () => {
      expect(address("foo", undefined)).toBe("http://foo");
      expect(address("foo.com", undefined)).toBe("http://foo.com");
      expect(address("foo.com", 80)).toBe("http://foo.com");
      expect(address("foo.com", "4200")).toBe("http://foo.com:4200");
      expect(address("127.0.0.1", "4200")).toBe("http://127.0.0.1:4200");
      expect(address("127.0.0.1", "4200")).toBe("http://127.0.0.1:4200");
      expect(address("[::1]", "4200")).toBe("http://[::1]:4200");
    });

    it("should accept protocols: HTTP, HTTPS and WS protocols", () => {
      expect(address("127.0.0.1", "4200", "http")).toBe("http://127.0.0.1:4200");
      expect(address("127.0.0.1", "4200", "https")).toBe("https://127.0.0.1:4200");
      expect(address("127.0.0.1", "4200", "ws")).toBe("ws://127.0.0.1:4200");
    });
  });

  describe("hostnameToIpAdress()", () => {
    it("should recognize locahost", () => {
      expect(hostnameToIpAdress("localhost")).toBe("127.0.0.1");
    });

    it("should recognize locahost", () => {
      expect(hostnameToIpAdress("localhost")).toBe("127.0.0.1");
    });

    it("should ignore IP addresses", () => {
      expect(hostnameToIpAdress("192.168.0.0")).toBe("192.168.0.0");
    });

    it("should ignore host names", () => {
      expect(hostnameToIpAdress("foo.bar")).toBe("foo.bar");
    });
  });

  describe("parseUrl()", () => {
    it("should specify port 443 for https URLs", () => {
      expect(parseUrl("https://foo.com")).toMatchObject({ port: 443 });
    });
    it("should specify port 80 for http URLs", () => {
      expect(parseUrl("http://foo.com")).toMatchObject({ port: 80 });
    });
    it("should parse the port given in the URL", () => {
      expect(parseUrl("https://foo.com:9999")).toMatchObject({ port: 9999 });
    });
  });
});
