import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const base = path.join(root, "src", specifier.slice(2));
  const file = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
  if (!file) {
    return nextResolve(specifier, context);
  }

  return {
    url: pathToFileURL(file).href,
    shortCircuit: true,
  };
}
