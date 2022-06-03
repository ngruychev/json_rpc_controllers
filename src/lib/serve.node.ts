import { handleRequest } from "./core/handle.ts";
import { JSON_RPC_SERVICE_KEY } from "./core/decorators.ts";
import { JsonRpcController, JsonRpcErrorCode } from "./core/types.ts";
// dnt-node-remove-line
import { WebSocketServer } from "../deps.node.ts";
// dnt-node-remove-line
import { createServer } from "https://deno.land/std@0.140.0/node/http.ts";
// dnt-node-uncomment-line
// import { WebSocketServer } from "ws";
// dnt-node-uncomment-line
// import { createServer } from "http";

export function serveJsonRpcHttp(
  service: JsonRpcController,
  serveOptions: {
    port?: number;
  },
): Promise<void> {
  const isService =
    !!(Reflect.getMetadata(JSON_RPC_SERVICE_KEY, service.constructor));
  if (!isService) {
    throw new Error(
      "not a service. service must be decorated with @JsonRpcService",
    );
  }

  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Invalid Request",
          data: "Only POST requests are accepted.",
        },
        id: null,
      }));
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      const resp = await handleRequest(service, body);
      if (resp === undefined) {
        res.writeHead(204, {
          "Content-Type": "application/json",
        });
        res.end();
        return;
      }
      const status = "error" in resp
        ? resp.error.code === JsonRpcErrorCode.InternalError ? 500 : 400
        : 200;
      res.writeHead(status, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(resp));
    });
  }).listen(serveOptions.port);
  console.debug(`Listening on http://localhost:${serveOptions.port}`);
  const wss = new WebSocketServer({
    server,
  });
  wss.on("connection", (ws) => {
    ws.on("message", async (msg) => {
      const bodyStr = msg.toString();
      const resp = await handleRequest(service, bodyStr);
      if (resp === undefined) {
        return;
      }
      ws.send(JSON.stringify(resp));
    });
  });
  return new Promise((resolve) => server.on("close", () => resolve()));
}
