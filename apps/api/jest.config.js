/**
 * feature 006 (spec Constituição IV — Test-Backed Quality): `apps/api` já
 * declarava `jest`/`ts-jest` como devDependencies e um script `"test": "jest"`,
 * mas nenhum jest.config.* existia em lugar nenhum do monorepo — `jest` sem
 * configuração nenhuma não entende TypeScript, então `pnpm -r test` nunca
 * rodou de fato nenhum `*.spec.ts` desta app. Config mínima, no padrão
 * default do NestJS, para que os testes desta feature (e futuros) rodem.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
};
