module.exports = {
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.+(ts)", "**/?(*.)+(spec|test).+(ts)"],
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts)$": "ts-jest",
  },
  setupFilesAfterEnv: ["jest-extended/all"],
  verbose: true,
};
