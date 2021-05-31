/// <reference types="cypress" />

context("Mime types", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234/");
  });

  describe(`Accessing /index.html`, () => {
    it(`should respond text/html`, () => {
      cy.request(`http://0.0.0.0:1234/index.html`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("text/html");
      });
    });
  });

  describe(`Accessing /test.swaconfig`, () => {
    it(`should respond text/html`, () => {
      cy.request({ url: `http://0.0.0.0:1234/test.swaconfig`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers["content-type"]).to.include("application/json");
      });
    });
  });
});
