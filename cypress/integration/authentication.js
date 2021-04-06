/// <reference types="cypress" />

context("/.auth/me", () => {
  let clientPrincipal;

  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");

    clientPrincipal = {
      identityProvider: "facebook",
      userId: "d75b260a64504067bfc5b2905e3b8182",
      userDetails: "user@example.com",
      userRoles: ["authenticated"],
    };
  });

  describe("when user is not logged in", () => {
    it("should have clientPrincipal to null", () => {
      cy.clearCookie("StaticWebAppsAuthCookie");

      cy.request("/.auth/me").should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("clientPrincipal").to.eq(null);
        expect(response).to.have.property("headers");
      });
    });
  });

  describe("when user is logged in", () => {
    it("should have clientPrincipal to be populated", () => {
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));

      cy.request("/.auth/me").should((response) => {
        console.log({ response });
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal).to.deep.eq(clientPrincipal);
      });
    });
    it("should have authenticated role", () => {
      clientPrincipal.userRoles = ["foo"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request("/.auth/me").should((response) => {
        console.log({ response });
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal.userRoles).to.deep.eq(["foo", "anonymous", "authenticated"]);
      });
    });
  });
});

context("/.auth/login/github", () => {
  let clientPrincipal;

  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234/.auth/login/github");

    clientPrincipal = {
      identityProvider: "facebook",
      userId: "d75b260a64504067bfc5b2905e3b8182",
      userDetails: "user@example.com",
      userRoles: ["anonymous", "authenticated"],
    };

    cy.clearCookie("StaticWebAppsAuthCookie");
  });

  describe("when using GitHub provider", () => {
    it("provider should be 'github'", () => {
      cy.get("#identityProvider").should("be.disabled");
      cy.get("#identityProvider").should("have.value", "github");
    });
    it("username should be empty", () => {
      cy.get("#userDetails").should("be.empty");
    });
    it("userId should be empty", () => {
      cy.get("#userId").should("be.empty");
    });
    it("userRoles should contains authenticated and anonymous roles", () => {
      cy.get("#userRoles").should("have.value", "anonymous\nauthenticated");
    });
  });
});
