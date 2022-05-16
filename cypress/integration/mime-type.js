/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

context("Mime types", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234/");
  });

  describe(`Valid mime types`, () => {
    it(`should respond text/html when accessing /index.html`, () => {
      cy.request(`http://0.0.0.0:1234/index.html`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("text/html");
      });
    });
  });

  describe(`Custom mime types`, () => {
    it(`should respond with custom mime type application/json when accessing /test.swaconfig`, () => {
      cy.request({ url: `http://0.0.0.0:1234/test.swaconfig`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("application/json");
      });
    });
  });

  describe(`Default mime type`, () => {
    it(`should respond with default mime type application/octet-stream when accessing /foo.bar`, () => {
      cy.request({ url: `http://0.0.0.0:1234/foo.bar`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("application/octet-stream");
      });
    });
  });
});
