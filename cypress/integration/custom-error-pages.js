/// <reference types="cypress" />

const testSuite = (code) => () => {
  it(`should respond with ${code} status code`, () => {
    cy.request({ url: `http://0.0.0.0:1234/status-code-${code}.txt`, failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(code);
    });
  });

  it(`should display custom ${code} page`, () => {
    cy.visit({ url: `http://0.0.0.0:1234/status-code-${code}.txt`, failOnStatusCode: false });
    cy.get("h1").should("contain.text", `custom ${code}`);
  });
};

context("Error pages", () => {
  const ERROR_STATUS_CODES = [401, 403, 404];
  for (let index = 0; index < ERROR_STATUS_CODES.length; index++) {
    const code = ERROR_STATUS_CODES[index];
    describe(`Custom ${code} page`, testSuite(code));
  }
});
