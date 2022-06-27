import { MyService } from "./MyService.ts";
import { serveJsonRpcHttp } from "../../server.ts";

const ms = new MyService();
await serveJsonRpcHttp(ms, {
  port: 3000,
});
