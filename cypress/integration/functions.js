/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

context.only("/api", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234/");
  });

  describe(`Accessing /api/headers`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/headers`, failOnStatusCode: false }).then((response) => {
        const body = Object.keys(response.body);
        expect(response.status).to.eq(200);
        expect(body).to.include("x-ms-original-url");
        expect(body).to.include("x-ms-request-id");
        expect(body).to.include("x-swa-custom");
      });
    });
    it("Should correctly set x-ms-original-url to the full request url", () => {
      const HEADER_URL = "http://0.0.0.0:1234/api/headers";
      cy.request({ url: HEADER_URL, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body["x-ms-original-url"]).to.equal(HEADER_URL);
      });
    });
  });

  describe(`Accessing /api/status`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/status`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.eq("/api/status");
      });
    });
  });

  describe(`Accessing /api/info`, () => {
    it(`should respond with 401 when user not logged in`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/info`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
    it(`should respond with with content when user is logged in`, () => {
      const clientPrincipal = {
        identityProvider: "facebook",
        userId: "d75b260a64504067bfc5b2905e3b8182",
        userDetails: "user@example.com",
        userRoles: ["authenticated"],
      };
      const SWA_AUTH_COOKIE_NAME = "StaticWebAppsAuthCookie";

      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));

      cy.request({ url: `http://0.0.0.0:1234/api/info`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.eq("authorized");
      });
    });
  });

  describe(`Accessing non existing endoint`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/path-does-not-exists`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  describe(`Accessing /api/error`, () => {
    it(`should respond with valid status code 403`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/error`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });
  });
});
