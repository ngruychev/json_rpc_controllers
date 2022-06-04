import { Reflect, zod } from "../../deps.ts";
import { JSON_RPC_METHODS_KEY, JSON_RPC_VALIDATOR_KEY } from "./decorators.ts";

import {
  JsonRpcBatchRequest,
  JsonRpcBatchResponse,
  JsonRpcController,
  JsonRpcError,
  JsonRpcErrorCode,
  JsonRpcResponse,
  JsonRpcSingleErrorResponse,
  JsonRpcSingleRequest,
  JsonRpcSingleResponse,
} from "./types.ts";

function error(
  id: string | number | null,
  code: JsonRpcErrorCode | number,
  message: string,
  data?: JsonRpcError["data"],
): JsonRpcSingleErrorResponse {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      data,
    },
    id,
  };
}

async function handleSingleRequest(
  service: JsonRpcController,
  request: JsonRpcSingleRequest,
): Promise<JsonRpcSingleResponse | undefined> {
  if (
    request.jsonrpc !== "2.0" || !request.method ||
    typeof request.method !== "string" ||
    (request.id && typeof request.id !== "number" &&
      typeof request.id !== "string" &&
      request.id !== null) ||
    (request.id && typeof request.id === "number" && request.id % 1 !== 0)
  ) {
    return error(
      ["number", "string"].includes(typeof request.id) ||
        request.id === null
        ? request.id ?? null
        : null,
      JsonRpcErrorCode.InvalidRequest,
      "Invalid Request",
      "The JSON sent is not a valid Request object.",
    );
  }

  const isNotification = !("id" in request) && request.id !== undefined;

  if (
    !Reflect.getMetadata(JSON_RPC_METHODS_KEY, service).includes(
      request.method,
    ) ||
    !(request.method in service) ||
    // deno-lint-ignore no-explicit-any
    typeof (service as any)[request.method] !== "function" ||
    request.method === "" || request.method === "constructor"
  ) {
    return isNotification ? undefined : error(
      request.id!,
      JsonRpcErrorCode.MethodNotFound,
      "Method not found",
      `The method "${request.method}" does not exist / is not available.`,
    );
  }

  const validator = Reflect.getMetadata(
    JSON_RPC_VALIDATOR_KEY,
    service,
    request.method,
  ) as zod.Schema | undefined;
  if (
    typeof request.params !== "object" || request.params === null ||
    (validator && !validator.safeParse(request.params).success)
  ) {
    return isNotification ? undefined : error(
      request.id!,
      JsonRpcErrorCode.InvalidParams,
      "Invalid params",
      "Invalid method parameter(s).",
    );
  }

  let result;
  try {
    const params = ([] as unknown[]).concat(request.params);
    // deno-lint-ignore no-explicit-any
    result = await (service as any)[request.method](...params);
  } catch (err) {
    if (err instanceof JsonRpcError) {
      const { code, message, data } = err;
      return isNotification
        ? undefined
        : error(request.id!, code, message, data);
    } else {
      return isNotification ? undefined : error(
        request.id!,
        JsonRpcErrorCode.InternalError,
        "Internal error",
        err,
      );
    }
  }

  return isNotification ? undefined : {
    jsonrpc: "2.0",
    result,
    id: request.id!,
  };
}

async function handleBatchRequest(
  service: JsonRpcController,
  request: JsonRpcBatchRequest,
): Promise<JsonRpcBatchResponse | JsonRpcSingleErrorResponse> {
  if (!Array.isArray(request) || request.length === 0) {
    return error(
      null,
      JsonRpcErrorCode.InvalidRequest,
      "Invalid Request",
      "The JSON sent is not a valid Request object.",
    );
  }
  const responses = (await Promise.all(
    request
      .map((item) => handleSingleRequest(service, item)),
  ))
    .filter((x) => x !== undefined)
    .map((x) => x as JsonRpcSingleResponse);
  return responses;
}

export async function handleRequest(
  service: JsonRpcController,
  request: string,
): Promise<JsonRpcResponse | undefined> {
  try {
    const parsed = JSON.parse(request);
    if (Array.isArray(parsed)) {
      return await handleBatchRequest(service, parsed);
    } else {
      return await handleSingleRequest(service, parsed) ?? undefined;
    }
  } catch (err) {
    return error(null, JsonRpcErrorCode.ParseError, "Parse error", err);
  }
}
