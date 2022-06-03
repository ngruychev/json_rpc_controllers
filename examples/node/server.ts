import { MyService } from "./MyService";
import { serveJsonRpcHttp } from "@ngruychev/json_rpc_controllers/server";

const ms = new MyService();
serveJsonRpcHttp(ms, {
  port: 3000,
}).catch((e) => console.error(e));
