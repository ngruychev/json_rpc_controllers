import { Reflect, serve } from "../deps.ts";

import { handleRequest } from "./core/handle.ts";
import { JSON_RPC_SERVICE_KEY } from "./core/decorators.ts";
import { JsonRpcController, JsonRpcErrorCode } from "./core/types.ts";

async function serveRegularRequest(
  service: JsonRpcController,
  req: Request,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Invalid Request",
          data: "Only POST requests are accepted.",
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  const bodyStr = await req.text();
  const resp = await handleRequest(service, bodyStr);
  if (resp === undefined) {
    return new Response(undefined, {
      status: 204,
    });
  }
  return new Response(
    JSON.stringify(resp),
    {
      status: "error" in resp
        ? resp.error.code === JsonRpcErrorCode.InternalError ? 500 : 400
        : 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

function serveWebsocket(
  service: JsonRpcController,
  req: Request,
): Response {
  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  ws.addEventListener("message", async (msg) => {
    const bodyStr = msg.data.toString();
    const resp = await handleRequest(service, bodyStr);
    if (resp === undefined) {
      return;
    }
    ws.send(JSON.stringify(resp));
  });
  return response;
}

export async function serveJsonRpcHttp(
  service: JsonRpcController,
  serveOptions: {
    port?: number;
  },
) {
  const isService =
    !!(Reflect.getMetadata(JSON_RPC_SERVICE_KEY, service.constructor));
  if (!isService) {
    throw new Error(
      "not a service. service must be decorated with @JsonRpcService",
    );
  }
  await serve(async (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
      return await serveRegularRequest(service, req);
    }
    return serveWebsocket(service, req);
  }, serveOptions);
}
