/// <reference types="cypress" />

context.only("/api", () => {
  beforeEach(() => {
    cy.visit("http://0.0.0.0:1234/");
  });

  describe(`Accessing /api/headers`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/headers`, failOnStatusCode: false }).then((response) => {
        console.log(response);
        const body = Object.keys(response.body);
        expect(response.status).to.eq(200);
        expect(body).to.include("x-ms-original-url");
        expect(body).to.include("x-ms-request-id");
        expect(body).to.include("x-swa-custom");
      });
    });
  });

  describe(`Accessing /api/status`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/status`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.eq("/api/status");
      });
    });
  });

  describe(`Accessing non existing endoint`, () => {
    it(`should respond with valid body content`, () => {
      cy.request({ url: `http://0.0.0.0:1234/api/path-does-not-exists`, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });
});
