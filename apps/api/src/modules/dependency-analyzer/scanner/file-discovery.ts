import fg from "fast-glob";

/**
 * spec (Mapa de Dependências) §4.2/§4.3/8-Etapa 1: base language is
 * JavaScript/TypeScript, with React/Vue/Node.js as the initially supported
 * frameworks — the parser used per file is chosen by extension (see
 * `source-parser.ts`), not by framework, so `.vue` is included here
 * alongside the plain JS/TS extensions.
 */
const INCLUDED_EXTENSIONS = ["ts", "tsx", "js", "jsx", "vue"];
const IGNORED_DIRECTORIES = ["node_modules", ".git", "dist", "build", "coverage"];

export async function discoverSourceFiles(repositoryRoot: string): Promise<string[]> {
  return fg(`**/*.{${INCLUDED_EXTENSIONS.join(",")}}`, {
    cwd: repositoryRoot,
    absolute: true,
    ignore: IGNORED_DIRECTORIES.map((dir) => `**/${dir}/**`),
    onlyFiles: true,
  });
}
