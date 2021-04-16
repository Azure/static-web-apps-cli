/// <reference types="cypress" />

const PROVIDERS = ["github", "twitter", "facebook", "aad"];
const clientPrincipal = {
  identityProvider: "facebook",
  userId: "d75b260a64504067bfc5b2905e3b8182",
  userDetails: "user@example.com",
  userRoles: ["authenticated"],
};

context("/.auth/me", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
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
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal).to.deep.eq(clientPrincipal);
      });
    });
    it("should have authenticated role", () => {
      clientPrincipal.userRoles = ["foo"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request("/.auth/me").should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.clientPrincipal.userRoles).to.deep.eq(["foo", "anonymous", "authenticated"]);
      });
    });
  });
});

context(`/.auth/login/<provider>`, () => {
  // google has a special config (check staticwebapp.config.json)
  // { "route": "/*.google", "redirect": "https://www.google.com/" }
  describe(`when using provider: google`, () => {
    it(`should redirect to https://www.google.com/`, async () => {
      cy.visit("http://0.0.0.0:1234/.auth/login/google").then((response) => {
        expect(response.status).to.be(302);
        expect(response.headers.get("location")).to.be("https://www.google.com/");
      });
    });
  });

  for (let index = 0; index < PROVIDERS.length; index++) {
    const provider = PROVIDERS[index];
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
      cy.get("meta[name='swa:originalPath']").should("have.attr", "content", "/.auth/login/github");
    });
  });

  describe("when using custom /logout route", () => {
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
    for (let index = 0; index < PROVIDERS.length; index++) {
      const provider = PROVIDERS[index];
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
    it("should return 403 if no roles provided in client principal", () => {
      clientPrincipal.userRoles = [];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).should((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it("should return 403 for non-authenticated roles", () => {
      clientPrincipal.userRoles = ["admin"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it("should return 200 for authenticated roles", () => {
      clientPrincipal.userRoles = ["authenticated"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/only-authenticated", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe("accessing /api/info ", () => {
    it("should return 403 if no roles provided", () => {
      clientPrincipal.userRoles = [];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/api/info", failOnStatusCode: false }).should((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it("should return 403 for non-authenticated roles", () => {
      clientPrincipal.userRoles = ["admin"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/api/info", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it("should return 404 for authenticated roles but invalid api endpoint", () => {
      clientPrincipal.userRoles = ["authenticated"];
      cy.setCookie("StaticWebAppsAuthCookie", window.btoa(JSON.stringify(clientPrincipal)));
      cy.request({ url: "http://0.0.0.0:1234/api/info", failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });
});
