/// <reference types="cypress" />

Cypress.Screenshot.defaults({
  screenshotOnRunFailure: false,
});

context("Error pages", () => {
  describe(`Custom 401 page`, () => {
    it(`should respond with 401 status code`, () => {
      cy.request({ url: `http://0.0.0.0:1234/status-code-401.txt`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it(`should display custom 401 page`, () => {
      cy.visit({ url: `http://0.0.0.0:1234/status-code-401.txt`, failOnStatusCode: false });
      cy.get("h1").should("contain.text", `custom 401`);
    });
  });

  describe(`Custom 403 page`, () => {
    it(`should respond with 403 status code`, () => {
      cy.request({ url: `http://0.0.0.0:1234/status-code-403.txt`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });

    it(`should display custom 403 page`, () => {
      cy.visit({ url: `http://0.0.0.0:1234/status-code-403.txt`, failOnStatusCode: false });
      cy.get("h1").should("contain.text", `custom 403`);
    });
  });

  describe(`Custom 404 page`, () => {
    it(`should respond with 404 status code`, () => {
      cy.request({ url: `http://0.0.0.0:1234/status-code-404.txt`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it(`should display custom 404 page`, () => {
      cy.visit({ url: `http://0.0.0.0:1234/status-code-404.txt`, failOnStatusCode: false });
      cy.get("h1").should("contain.text", `custom 404`);
    });
  });
});
