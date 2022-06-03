import {
  closeWebsocketJsonRpcProxy,
  createHttpJsonRpcProxy,
  createWebsocketJsonRpcProxy,
  JsonRpcError,
} from "https://deno.land/x/json_rpc_controllers@0.0.3/client.ts";
import type { MyService } from "./MyService.ts";

const httpProxy = createHttpJsonRpcProxy<MyService>("http://localhost:3000");

// regular call
console.log(await httpProxy.hello("RPC"));

// something that takes a while
console.time("slowAdd");
console.log(await httpProxy.slowAdd(1, 2));
console.timeEnd("slowAdd");

// and that throws an error
try {
  await httpProxy.throws();
} catch (e) {
  console.assert(e instanceof JsonRpcError, "the error is a JsonRpcError");
  console.error(e);
}

console.log(
  await httpProxy.subtract({
    minuend: 1,
    subtrahend: 2,
  }),
);

const wsProxy = createWebsocketJsonRpcProxy<MyService>("ws://localhost:3000");

console.log(await wsProxy.hello("websockets"));

await Promise.all([
  wsProxy.slowAdd(1, 2).then((result) => console.log(result)), // should get logged last
  wsProxy.subtract({
    minuend: 1,
    subtrahend: 2,
  }).then((result) => console.log(result)),
]);

// if you don't close a websocket proxy, it can keep your program running forever
closeWebsocketJsonRpcProxy(wsProxy);
