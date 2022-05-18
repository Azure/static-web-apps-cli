/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

const SWA_AUTH_COOKIE_NAME = "StaticWebAppsAuthCookie";
const clientPrincipal = {
  identityProvider: "facebook",
  userId: "d75b260a64504067bfc5b2905e3b8182",
  userDetails: "user@example.com",
  userRoles: ["authenticated"],
  claims: [
    {
      typ: "name",
      val: "Azure Static Web Apps",
    },
  ],
};

context("Authorization", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
  });

  ["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH", "OPTIONS"].forEach(test);

  function test(method) {
    describe(`accessing /api/info using ${method} method`, () => {
      it("should return 401 if no roles provided", () => {
        clientPrincipal.userRoles = [];
        cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
        cy.request({ url: "http://0.0.0.0:1234/api/info", method, failOnStatusCode: false }).then((response) => {
          expect(response.status).to.eq(401);
        });
      });

      it("should return 401 for non 'authenticated' roles", () => {
        clientPrincipal.userRoles = ["admin"];
        cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
        cy.request({ url: "http://0.0.0.0:1234/api/info", method, failOnStatusCode: false }).then((response) => {
          expect(response.status).to.eq(401);
        });
      });

      it("should return 404 for 'authenticated' roles but invalid api endpoint", () => {
        clientPrincipal.userRoles = ["authenticated"];
        cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
        cy.request({ url: "http://0.0.0.0:1234/api/foo/bar", method, failOnStatusCode: false }).then((response) => {
          expect(response.status).to.eq(404);
        });
      });
    });
  }

  describe("Accessing /.auth/login/aad", () => {
    it("should return 404", () => {
      cy.request({ url: "http://0.0.0.0:1234/.auth/login/aad", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });
});
