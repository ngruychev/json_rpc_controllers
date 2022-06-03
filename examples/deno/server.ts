import { MyService } from "./MyService.ts";
import { serveJsonRpcHttp } from "https://deno.land/x/json_rpc_controllers@0.0.3/server.ts";

const ms = new MyService();
await serveJsonRpcHttp(ms, {
  port: 3000,
});
