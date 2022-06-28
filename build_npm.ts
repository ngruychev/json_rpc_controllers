import { emptyDir } from "https://deno.land/x/dnt@0.24.0/mod.ts";
import { transform } from "https://deno.land/x/dnt@0.24.0/transform.ts";
import {
  common,
  dirname,
  join,
} from "https://deno.land/std@0.140.0/path/mod.ts";
import { copy } from "https://deno.land/std@0.140.0/fs/mod.ts";

import { bundle } from "https://deno.land/x/emit@0.2.0/mod.ts";

const VERSION = "0.1.1";

console.log(`Building version ${VERSION}`);

console.log("Clearing npm directory...");
await emptyDir("./npm");

console.log("Building...");
const outputResult = await transform({
  entryPoints: [
    "./mod.ts",
    "./client.ts",
    "./server.ts",
  ],
  target: "Latest",
  shims: [
    {
      package: {
        name: "undici",
        version: "^5.3.0",
      },
      globalNames: [
        "fetch",
        "File",
        "FormData",
        "Headers",
        "Request",
        "Response",
      ],
    },
    {
      package: {
        name: "ws",
        version: "^8.7.0",
      },
      globalNames: [{
        name: "WebSocket",
        exportName: "WebSocket",
      }, {
        name: "MessageEvent",
        exportName: "MessageEvent",
        typeOnly: true,
      }, {
        name: "WebSocketServer",
        exportName: "WebSocketServer",
      }],
    },
    {
      package: {
        name: "@deno/shim-crypto",
        version: "~0.3.0",
      },
      globalNames: [
        "crypto",
        ...[
          "Crypto",
          "SubtleCrypto",
          "AlgorithmIdentifier",
          "Algorithm",
          "RsaOaepParams",
          "BufferSource",
          "AesCtrParams",
          "AesCbcParams",
          "AesGcmParams",
          "CryptoKey",
          "KeyAlgorithm",
          "KeyType",
          "KeyUsage",
          "EcdhKeyDeriveParams",
          "HkdfParams",
          "HashAlgorithmIdentifier",
          "Pbkdf2Params",
          "AesDerivedKeyParams",
          "HmacImportParams",
          "JsonWebKey",
          "RsaOtherPrimesInfo",
          "KeyFormat",
          "RsaHashedKeyGenParams",
          "RsaKeyGenParams",
          "BigInteger",
          "EcKeyGenParams",
          "NamedCurve",
          "CryptoKeyPair",
          "AesKeyGenParams",
          "HmacKeyGenParams",
          "RsaHashedImportParams",
          "EcKeyImportParams",
          "AesKeyAlgorithm",
          "RsaPssParams",
          "EcdsaParams",
        ].map((name) => ({
          name,
          typeOnly: true,
        })),
      ],
    },
  ],
  mappings: {
    "./src/deps.ts": "./src/deps.node.ts",
    "./src/lib/serve.ts": "./src/lib/serve.node.ts",
  },
});

console.log("Building done.");
console.log("Writing files...");

// we don't need those
outputResult.main.files = outputResult.main.files.filter((file) =>
  !["deps/cdn.skypack.dev/ws.d.ts", "deps/cdn.skypack.dev/ws.js"].includes(
    file.filePath,
  ) &&
  !(common([`./${file.filePath}`, "./deps/deno.land/"]) === "./deps/deno.land/")
);

for (const file of outputResult.main.files) {
  const text = file.fileText
    // remove lines after a comment with "// dnt-node-remove-line"
    .replace(/^\s*\/\/\s*dnt-node-remove-line\s*\n.*$/gm, "")
    // uncomment line after a comment with "// dnt-node-uncomment-line"
    .replace(
      /^\s*\/\/\s*dnt-node-uncomment-line\s*\n\s*\/\/\s{0,1}/gm,
      "",
    );
  await Deno.mkdir(join("./npm", dirname(file.filePath)), { recursive: true });
  const path = join("./npm", file.filePath);
  await Deno.writeTextFile(path, text);
}

const dependencies: Record<string, string> = {};
for (const dep of outputResult.main.dependencies) {
  if (dep.name.startsWith("-/")) continue; // idk skypack bug
  dependencies[dep.name] = dep.version;
}

// write package.json
const packageJson = {
  name: "@ngruychev/json_rpc_controllers",
  version: VERSION,
  description:
    "Create class-based JSON-RPC services and use them seamlessly on the client-side",
  main: "./mod.js",
  types: "./mod.d.ts",
  browser: "./browser.js",
  exports: {
    ".": "./mod.js",
    "./client": "./client.js",
    "./server": "./server.js",
  },
  license: "MIT",
  dependencies,
  devDependencies: {
    "typescript": "^4.7.2",
    "@types/node": "^17.0.38",
  },
  scripts: {
    "tsc": "tsc",
  },
  keywords: [
    "json-rpc",
    "rpc",
    "json",
    "remote",
    "node",
    "controller",
    "decorator",
  ],
  repository: "github:ngruychev/json_rpc_controllers",
};

console.log("Writing package.json...");

await Deno.writeTextFile(
  "./npm/package.json",
  JSON.stringify(packageJson, null, 2),
);

console.log("Copying tsconfig.node.json...");
await copy("./tsconfig.node.json", "./npm/tsconfig.json");

console.log("Copying README.md...");
await copy("./README.md", "./npm/README.md");

console.log("Running npm install...");
const installProcess = Deno.run({
  cmd: ["npm", "--prefix", "./npm", "install"],
});
try {
  if (!(await installProcess.status()).success) {
    throw new Error("npm install failed");
  }
} finally {
  installProcess.close();
}

console.log("Running tsc...");
const tscProcess = Deno.run({
  cmd: ["npm", "--prefix", "./npm", "run", "tsc"],
});
try {
  if (!(await tscProcess.status()).success) {
    throw new Error("tsc failed");
  }
} finally {
  tscProcess.close();
}

console.log("Bundling browser.js...");
const browserBundle = await bundle("./client.ts");
await Deno.writeTextFile("./npm/browser.js", browserBundle.code);
await copy("./npm/client.d.ts", "./npm/browser.d.ts");

console.log("All done!");
