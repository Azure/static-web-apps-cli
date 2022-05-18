/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});
Cypress.Cookies.defaults({
  domain: "0.0.0.0",
});
Cypress.Cookies.debug(true);

// we are not including AAD in this list because it has a special rule (see staticwebapp.config.json)
const PROVIDERS_AVAILABLE = ["google", "github", "twitter", "facebook"];
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

context("Authentication", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
  });

  describe("when user is not logged in", () => {
    it("should have clientPrincipal to null", () => {
      cy.clearCookie(SWA_AUTH_COOKIE_NAME);

      cy.request("/.auth/me").should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("clientPrincipal").to.eq(null);
        expect(response).to.have.property("headers");
      });
    });
  });

  describe("when user is logged in", () => {
    it("should have clientPrincipal to be populated", () => {
      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));

      cy.request("/.auth/me").should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal.identityProvider).to.deep.eq(clientPrincipal.identityProvider);
        expect(response.body.clientPrincipal.userId).to.deep.eq(clientPrincipal.userId);
        expect(response.body.clientPrincipal.userDetails).to.deep.eq(clientPrincipal.userDetails);
        expect(response.body.clientPrincipal.userRoles).to.deep.eq(clientPrincipal.userRoles);
        expect(response.body.clientPrincipal.claims).to.deep.eq(clientPrincipal.claims);
      });
    });
    it("should have authenticated role", () => {
      clientPrincipal.userRoles = ["foo"];
      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
      cy.request("/.auth/me").should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal.userRoles).to.deep.eq(["foo", "anonymous", "authenticated"]);
      });
    });
  });
});

context(`/.auth/login/<provider>`, () => {
  for (let index = 0; index < PROVIDERS_AVAILABLE.length; index++) {
    const provider = PROVIDERS_AVAILABLE[index];
    describe(`when using provider: ${provider}`, () => {
      it(`provider should be ${provider}`, () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#identityProvider").should("be.disabled");
        cy.get("#identityProvider").should("have.value", provider);
      });
      it("username should be empty", () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#userDetails").should("be.empty");
      });
      it("userId should be empty", () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#userId").should("be.empty");
      });
      it("userRoles should contains authenticated and anonymous roles", () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#userRoles").should("have.value", "anonymous\nauthenticated");
      });
      it("claims should contains an empty array", () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#claims").should("have.value", "[]");
      });
    });
  }
});

context("/.auth/logout", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
  });

  describe("when using accessing /.auth/logout", () => {
    it("should redirect to / with code=302", () => {
      cy.request({
        url: "/.auth/logout",
        followRedirect: false,
      }).as("response");

      cy.get("@response")
        .its("headers")
        .then((headers) => {
          expect(headers).to.deep.include({
            status: "302",
            location: "http://0.0.0.0:1234/",
            "set-cookie": ["StaticWebAppsAuthCookie=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"],
          });
        });
    });
  });
});

context("custom routes for login/logout", () => {
  describe("when using custom route /login-github", () => {
    beforeEach(() => {
      cy.visit("http://0.0.0.0:1234/login-github");
    });
    it("provider should be 'github'", () => {
      cy.get("#identityProvider").should("be.disabled");
      cy.get("#identityProvider").should("have.value", "github");
    });

    it("should have meta tag", () => {
      cy.get("meta[name='swa:originalPath']").should("have.attr", "content", "http://0.0.0.0:1234/.auth/login/github");
    });
  });

  describe("when using custom /logout route", () => {
    beforeEach(() => {
      cy.visit("http://0.0.0.0:1234/");
    });
    it("should redirect to / with code=302", () => {
      cy.request({
        url: "/logout",
        followRedirect: false,
      }).as("response");

      cy.get("@response")
        .its("headers")
        .then((headers) => {
          expect(headers).to.deep.include({
            status: "302",
            location: "http://0.0.0.0:1234/",
            "set-cookie": ["StaticWebAppsAuthCookie=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"],
          });
        });
    });
  });
});

context("checking localStorage", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });
  describe("caching auth info in localStorage", () => {
    for (let index = 0; index < PROVIDERS_AVAILABLE.length; index++) {
      const provider = PROVIDERS_AVAILABLE[index];
      it(`should cache auth: ${provider}`, () => {
        cy.visit(`http://0.0.0.0:1234/.auth/login/${provider}`);
        cy.get("#userDetails")
          .type(`foobar-${provider}`)
          .trigger("keyup")
          .should(() => {
            const authInfo = localStorage.getItem(`auth@${provider}`);
            expect(authInfo).not.to.be.null;

            const json = JSON.parse(authInfo);
            expect(json.userId.length).to.eq(32);
            expect(json.identityProvider).to.eq(provider);
            expect(json.userDetails).to.eq(`foobar-${provider}`);
            expect(json.userRoles).to.deep.eq(["anonymous", "authenticated"]);
            expect(json.claims).to.deep.eq([]);
          });
      });
    }
  });
});

context("UI buttons", () => {
  describe("Login button", () => {
    it("should not submit if missing userId ", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github`);
      cy.get("#userId").clear();
      cy.get("#submit").click();

      cy.get("#userId:invalid").should("exist");
    });

    it("should not submit if missing userDetails ", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github`);
      cy.get("#userDetails").clear();
      cy.get("#submit").click();

      cy.get("#userDetails:invalid").should("exist");
    });

    it("should not submit if invalid claims JSON value", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github`);
      cy.get("#claims").type("*&^%$#@!");

      cy.get("#userClaimsHelpBlockError").should("be.visible");
      cy.get("#submit").should("be.disabled");
    });

    it("should submit and redirect to /", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github`);
      cy.get("#userDetails").type("foo");
      cy.get("#submit")
        .click()
        .then(() => {
          cy.url().should("eq", "http://0.0.0.0:1234/");
        });
    });

    it("should submit and redirect to /home", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github?post_login_redirect_uri=/home`);
      cy.get("#userDetails").type("foo");
      cy.get("#submit")
        .click()
        .then(() => {
          cy.url().should("eq", "http://0.0.0.0:1234/home");
        });
    });
  });

  describe("Clear button", () => {
    it("should reset form", () => {
      cy.visit(`http://0.0.0.0:1234/.auth/login/github`);
      cy.get("#clear")
        .click()
        .then(() => {
          cy.get("#identityProvider").should("have.value", "github");
          cy.get("#userDetails").should("have.value", "");
          cy.get("#userRoles").should((element) => {
            expect(element.val()).to.eq("anonymous\nauthenticated");
          });
          cy.get("#userId").should((element) => {
            expect(element.val().length).to.eq(32);
          });

          expect(localStorage.getItem("auth@github")).not.to.be.null;
        });
    });
  });
});

context("Route authorization", () => {
  describe("accessing /only-authenticated", () => {
    it("should return 401 if no roles provided in client principal", () => {
      clientPrincipal.userRoles = [];
      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).should((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should return 401 for non 'authenticated' roles", () => {
      clientPrincipal.userRoles = ["admin"];
      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it("should return 200 for 'authenticated' roles", () => {
      clientPrincipal.userRoles = ["authenticated"];
      cy.setCookie(SWA_AUTH_COOKIE_NAME, window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });
});
