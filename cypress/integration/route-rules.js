/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

context("route rules engine", { failOnStatusCode: false, defaultCommandTimeout: 20000 /* set this for Windows */ }, () => {
  it("root returns /index.html", () => {
    cy.visit("http://0.0.0.0:1234/").should(() => {
      cy.title().should("eq", "/index.html");
    });
  });

  it("/index.html returns /index.html", () => {
    cy.visit("http://0.0.0.0:1234/index.html").should(() => {
      cy.title().should("eq", "/index.html");
    });
  });

  it("'/with space.html' returns '/with space.html'", () => {
    cy.visit("http://0.0.0.0:1234/with space.html").should(() => {
      cy.title().should("eq", "/with space.html");
    });
  });

  it("folder returns folder/index.html", () => {
    cy.visit("http://0.0.0.0:1234/folder/").should(() => {
      cy.title().should("eq", "/folder/index.html");
    });
  });

  it("folder '/another folder' returns '/another folder/index.html'", () => {
    cy.visit("http://0.0.0.0:1234/another folder/index.html").should(() => {
      cy.title().should("eq", "/another folder/index.html");
    });
  });

  it("rewrite to file returns correct content", () => {
    cy.visit("http://0.0.0.0:1234/rewrite_index2").should(() => {
      cy.title().should("eq", "/index2.html");
    });
  });

  it("rewrite to function returns function response", () => {
    cy.request("http://0.0.0.0:1234/rewrite-to-function").should((response) => {
      expect(response.body).to.have.property("x-swa-custom");
      expect(response.body["x-swa-custom"]).to.eq("/api/headers");
    });
  });

  it("content response contains global headers", () => {
    cy.request("http://0.0.0.0:1234/").should((response) => {
      expect(response.headers["a"]).to.eq("b");
    });
  });

  it("route headers override global headers", () => {
    cy.request("http://0.0.0.0:1234/rewrite_index2").should((response) => {
      expect(response.headers["a"]).to.eq("c");
    });
  });

  it("default redirect returns 302 with correct location", () => {
    cy.request("http://0.0.0.0:1234/redirect/foo").should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/index2.html");
    });
  });

  it("redirect with statusCode 302 returns 302 with correct location", () => {
    cy.request("http://0.0.0.0:1234/redirect/302").should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/index2.html");
    });
  });

  it("redirect with statusCode 301 returns 301 with correct location", () => {
    cy.request("http://0.0.0.0:1234/redirect/301").should((response) => {
      expect(response.redirects[0]).to.eq("301: http://0.0.0.0:1234/index2.html");
    });
  });

  it("navigation fallback returns /index.html", () => {
    cy.request("http://0.0.0.0:1234/does_not_exist.html").should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include("/index.html");
    });
  });

  it("navigation fallback that's excluded returns 404", () => {
    cy.request({
      failOnStatusCode: false,
      url: "http://0.0.0.0:1234/does_not_exist.txt",
    }).should((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it("/*.foo matches extension", () => {
    cy.request("http://0.0.0.0:1234/thing.foo").should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/foo.html");
    });
  });

  it("/redirect/*/invalid should not matched (invalid wildcard position)", () => {
    cy.request("http://0.0.0.0:1234/redirect/foo/invalid").should((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it("/*.{jpg} matches extension", () => {
    cy.request({
      url: "http://0.0.0.0:1234/thing.jpg",
      failOnStatusCode: false,
    }).should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/jpg.html");
      expect(response.status).to.eq(200);
      expect(response.body).to.include("/index.html");
    });
  });

  it("/*.{png,gif} matches multiple extensions", () => {
    cy.request("http://0.0.0.0:1234/thing.png").should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/png_gif.html");
    });

    cy.request("http://0.0.0.0:1234/thing.gif").should((response) => {
      expect(response.redirects[0]).to.eq("302: http://0.0.0.0:1234/png_gif.html");
    });
  });

  it("redirect can redirect to external URL", () => {
    cy.request("http://0.0.0.0:1234/something.google").should((response) => {
      expect(response.status).to.eq(200);
      expect(response.redirects[0]).to.eq("302: https://www.google.com/");
    });
  });

  it("rewrite to folder returns folder's default file", () => {
    cy.request("http://0.0.0.0:1234/folder/somefile.html").should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include("/folder/index.html");
    });
  });

  it("avoid accessing application configuration file", () => {
    cy.request({ url: "http://0.0.0.0:1234/staticwebapp.config.json", failOnStatusCode: false }).should((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it("should parse and ignore query params", () => {
    cy.request({ url: "http://0.0.0.0:1234/index.html?key=value&foo=bar", failOnStatusCode: false }).should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include("/index.html");
    });
  });

  it("should parse and ignore query params (when rule has wildcard)", () => {
    cy.request({ url: "http://0.0.0.0:1234/folder/index.html?key=value&foo=bar", failOnStatusCode: false }).should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include("/index.html");
    });
  });
});
