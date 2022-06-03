import { emptyDir } from "https://deno.land/x/dnt@0.24.0/mod.ts";
import { transform } from "https://deno.land/x/dnt@0.24.0/transform.ts";
import {
  basename,
  common,
  dirname,
  join,
} from "https://deno.land/std@0.140.0/path/mod.ts";
import { copy } from "https://deno.land/std@0.140.0/fs/mod.ts";

const VERSION = "0.0.4";

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

// fix/hack for https://github.com/denoland/dnt/issues/154
for (
  const fileName of outputResult.main.files.map(({ filePath }) =>
    basename(filePath)
  )
) {
  const filenameWithJsExt = fileName.replace(/\.ts$/, ".js");
  for (const file of outputResult.main.files) {
    console.log(
      `Replacing imports of ${filenameWithJsExt} with imports for ${fileName} in ${file.filePath}`,
    );
    file.fileText = file.fileText.replaceAll(
      filenameWithJsExt,
      fileName.replace(/\.ts$/, ""),
    );
  }
}

for (const file of outputResult.main.files) {
  let text = file.fileText;
  // remove lines after a comment with "// dnt-node-remove-line"
  text = text.replace(/^\s*\/\/\s*dnt-node-remove-line\s*\n.*$/gm, "");
  // uncomment line after a comment with "// dnt-node-uncomment-line"
  text = text.replace(
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
};

console.log("Writing package.json...");

await Deno.writeTextFile(
  "./npm/package.json",
  JSON.stringify(packageJson, null, 2),
);

console.log("Copying tsconfig.node.json...");
await copy("./tsconfig.node.json", "./npm/tsconfig.json");

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

console.log("All done!");
