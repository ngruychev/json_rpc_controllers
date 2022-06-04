import {
  JsonRpcController,
  JsonRpcError,
  JsonRpcSingleRequest,
} from "./core/types.ts";

// https://github.com/ai/nanoid
const nanoid = (size = 21) =>
  crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
    byte &= 63;
    if (byte < 36) {
      id += byte.toString(36);
    } else if (byte < 62) {
      id += (byte - 26).toString(36).toUpperCase();
    } else if (byte > 62) {
      id += "-";
    } else {
      id += "_";
    }
    return id;
  }, "");

// deno-lint-ignore no-explicit-any
type FnToAsync<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
  // deno-lint-ignore no-explicit-any
) => ReturnType<T> extends Promise<any> ? ReturnType<T>
  : Promise<ReturnType<T>>;

type FlagNonMethods<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
};

type MethodsOnly<T> = Pick<T, FlagNonMethods<T>[keyof FlagNonMethods<T>]>;

export type AsyncifyMethods<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any[]) => any ? FnToAsync<T[K]>
    : T[K];
};

const WEBSOCKET_PROXY_CLOSE_KEY = Symbol("websocket-proxy-close");

export type JsonRpcProxy<T> = MethodsOnly<AsyncifyMethods<T>> & {
  [WEBSOCKET_PROXY_CLOSE_KEY]: () => void;
};

export function createHttpJsonRpcProxy<T extends JsonRpcController>(
  url: string,
): JsonRpcProxy<T> {
  new URL(url); // throws if invalid URL
  return new Proxy({} as unknown as T, {
    get: (_target, key) => {
      return (({
        async [key](...params: unknown[]) {
          const request: JsonRpcSingleRequest = {
            jsonrpc: "2.0",
            method: key.toString(),
            params,
            id: nanoid(),
          };
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
          });
          if (response.status === 204) {
            return;
          }
          // deno-lint-ignore no-explicit-any
          const json = await response.json() as any;
          if ("error" in json) {
            throw new JsonRpcError(
              json.error.code,
              json.error.message,
              json.error.data,
            );
          }
          return json.result;
        },
        // deno-lint-ignore no-explicit-any
      }) as any)[key];
    },
  }) as unknown as JsonRpcProxy<T>;
}

export function createWebsocketJsonRpcProxy<T extends JsonRpcController>(
  url: string,
): JsonRpcProxy<T> {
  new URL(url); // throws if invalid URL
  const ws = new WebSocket(url);
  const wsOpenPromise = new Promise((resolve) => {
    ws.addEventListener("open", resolve);
  });
  const requestCompleters: Map<
    string | number,
    [(resp: unknown) => void, (err: JsonRpcError) => void]
  > = new Map();
  ws.addEventListener("message", (msg: MessageEvent) => {
    const bodyStr = msg.data.toString();
    const json = JSON.parse(bodyStr);
    if ("error" in json) {
      const err = new JsonRpcError(
        json.error.code,
        json.error.message,
        json.error.data,
      );
      if ("id" in json && json.id !== null) {
        requestCompleters.get(json.id)?.[1](err);
      } else {
        throw err;
      }
    } else {
      if ("id" in json && json.id !== null) {
        requestCompleters.get(json.id)?.[0](json.result);
      }
    }
  });
  return new Proxy({} as unknown as T, {
    get: (_target, key) => {
      if (key === WEBSOCKET_PROXY_CLOSE_KEY) {
        return () => {
          ws.close();
        };
      }
      return (({
        async [key](...params: unknown[]) {
          await wsOpenPromise;
          const request: JsonRpcSingleRequest = {
            jsonrpc: "2.0",
            method: key.toString(),
            params,
            id: nanoid(),
          };
          ws.send(JSON.stringify(request));
          return await new Promise((resolve, reject) => {
            requestCompleters.set(request.id!, [resolve, reject]);
          });
        },
        // deno-lint-ignore no-explicit-any
      }) as any)[key];
    },
  }) as unknown as JsonRpcProxy<T>;
}

export function closeWebsocketJsonRpcProxy<T>(proxy: JsonRpcProxy<T>) {
  proxy[WEBSOCKET_PROXY_CLOSE_KEY]();
}
