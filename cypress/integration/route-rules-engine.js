/// <reference types="cypress" />

context("route rules engine", { defaultCommandTimeout: 20000 /* set this for Windows */ }, () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
  });

  it("root returns /index.html", async () => {
    cy.request("/").then(() => {
      cy.title().should("eq", "/index.html");
    });
  });

  it("/index.html returns /index.html", async () => {
    cy.request("/index.html").then(() => {
      cy.title().should("eq", "/index.html");
    });
  });

  it("folder returns folder/index.html", async () => {
    cy.request("/folder/").then(() => {
      cy.title().should("eq", "/folder/index.html");
    });
  });

  it("rewrite to file returns correct content", async () => {
    cy.request("/rewrite_index2").then(() => {
      cy.title().should("eq", "/index2.html");
    });
  });

  it("rewrite to function returns function response", async () => {
    cy.request("/rewrite-to-function").then((response) => {
      expect(response).to.have.property("x-swa-custom");
      expect(response["x-swa-custom"]).to.be("/api/headers");
    });
  });

  it("content response contains global headers", async () => {
    cy.request("/").then((response) => {
      expect(response.headers.get("a")).to.be("b");
    });
  });

  it("route headers override global headers", async () => {
    cy.request("/rewrite_index2").then((response) => {
      expect(response.headers.get("a")).to.be("c");
    });
  });

  it("default redirect returns 302 with correct location", async () => {
    cy.request("/redirect/foo").as("response");

    cy.get("@response")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/index2.html",
        });
      });
  });

  it("redirect with statusCode 302 returns 302 with correct location", async () => {
    cy.request("/redirect/302").as("response");

    cy.get("@response")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/index2.html",
        });
      });
  });

  it("redirect with statusCode 301 returns 301 with correct location", async () => {
    cy.request("/redirect/301").as("response");

    cy.get("@response")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/index2.html",
        });
      });
  });

  it("setting mimetype of unknown file type returns correct mime type", async () => {
    cy.request("/test.swaconfig").then((response) => {
      expect(response.status).to.be(200);
      expect(response.headers.get("content-type")).to.be("application/json");
    });
  });

  it("navigation fallback returns /index.html", async () => {
    cy.request("/does_not_exist.html").then((response) => {
      expect(response.status).to.be(200);
      cy.title().should("eq", "/index.html");
    });
  });

  it("navigation fallback that's excluded returns 404", async () => {
    cy.request("/does_not_exist.txt").then((response) => {
      expect(response.status).to.be(404);
    });
  });

  it("/*.foo matches extension", async () => {
    cy.request("/thing.foo").as("response");

    cy.get("@response")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/foo.html",
        });
      });
  });

  it("/*.{jpg} matches extension", async () => {
    cy.request("/thing.jpg").as("response");

    cy.get("@response")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/jpg.html",
        });
      });
  });

  it("/*.{png,gif} matches multiple extensions", async () => {
    cy.request("/thing.png").as("response1");

    cy.get("@response1")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/png_gif.html",
        });
      });

    cy.request("/thing.gif").as("response2");

    cy.get("@response2")
      .its("headers")
      .then((headers) => {
        expect(headers).to.deep.include({
          status: "302",
          location: "http://0.0.0.0:1234/png_gif.html",
        });
      });
  });

  it("redirect can redirect to external URL", async () => {
    cy.request("/something.google").then((response) => {
      expect(response.status).to.be(302);
      expect(response.headers.get("location")).to.be("https://www.google.com/");
    });
  });

  it("rewrite to folder returns folder's default file", async () => {
    cy.request("/folder/somefile.html").then((response) => {
      expect(response.status).to.be(200);
      cy.title().should("eq", "/folder/index.html");
    });
  });
});
