/// <reference types="cypress" />

context("route rules engine", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234");
  });

  it("root returns /index.html", async () => {
    cy.request("/");
    cy.title().should("eq", "/index.html");
  });

  it("/index.html returns /index.html", async () => {
    cy.request("/index.html");
    cy.title().should("eq", "/index.html");
  });

  it("folder returns folder/index.html", async () => {
    cy.request("/folder/");
    cy.title().should("eq", "/folder/index.html");
  });

  it("rewrite to file returns correct content", async () => {
    cy.request("/rewrite_index2");
    cy.title().should("eq", "/index2.html");
  });

  it("rewrite to function returns function response", async () => {
    cy.request("/rewrite-to-function").as("response");
    cy.get("@response").should((response) => {
      expect(response).to.have.property("x-swa-custom");
      expect(response["x-swa-custom"]).to.be("/api/headers");
    });
  });

  it("content response contains global headers", async () => {
    cy.request({
      url: "/",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.headers.get("a")).to.be("b");
    });
  });

  // it("function response contains global headers", async () => {
  //     const response = await fetch(`${baseUrl}/api/headers`);
  //     expect(response.headers.get("a")).to.be("b");
  // })

  it("route headers override global headers", async () => {
    cy.request({
      url: "/rewrite_index2",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.headers.get("a")).to.be("c");
    });
  });

  it("default redirect returns 302 with correct location", async () => {
    cy.request({
      url: "/redirect/foo",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(302);
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/index2.html");
    });
  });

  it("redirect with statusCode 302 returns 302 with correct location", async () => {
    cy.request({
      url: "/redirect/302",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(302);
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/index2.html");
    });
  });

  it("redirect with statusCode 301 returns 301 with correct location", async () => {
    cy.request({
      url: "/redirect/301",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(301);
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/index2.html");
    });
  });

  it("setting mimetype of unknown file type returns correct mime type", async () => {
    cy.request({
      url: "/test.swaconfig",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(200);
      expect(response.headers.get("content-type")).to.be("application/json");
    });
  });

  it("navigation fallback returns /index.html", async () => {
    cy.request("/does_not_exist.html").as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(200);
      cy.title().should("eq", "/index.html");
    });
  });

  it("navigation fallback that's excluded returns 404", async () => {
    cy.request({
      url: "/does_not_exist.txt",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(404);
    });
  });

  it("/*.foo matches extension", async () => {
    cy.request({
      url: "/thing.foo",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/foo.html");
    });
  });

  it("/*.{jpg} matches extension", async () => {
    cy.request({
      url: "/thing.jpg",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/jpg.html");
    });
  });

  it("/*.{png,gif} matches multiple extensions", async () => {
    cy.request({
      url: "/thing.png",
      redirect: "manual",
    }).as("response1");

    cy.get("@response1").should((response) => {
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/png_gif.html");
    });

    cy.request({
      url: "/thing.gif",
      redirect: "manual",
    }).as("response2");

    cy.get("@response2").should((response) => {
      expect(response.headers.get("location").replace(new RegExp(`^${baseUrl.replace(".", "\\.")}`), "")).to.be("/png_gif.html");
    });
  });

  it("redirect can redirect to external URL", async () => {
    cy.request({
      url: "/something.google",
      redirect: "manual",
    }).as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(302);
      expect(response.headers.get("location")).to.be("https://www.google.com/");
    });
  });

  it("rewrite to folder returns folder's default file", async () => {
    cy.request("/folder/somefile.html").as("response");

    cy.get("@response").should((response) => {
      expect(response.status).to.be(200);
      cy.title().should("eq", "/folder/index.html");
    });
  });
});
