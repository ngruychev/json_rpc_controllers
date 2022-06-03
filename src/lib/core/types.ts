export interface JsonRpcSingleRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown[] | Record<string, unknown>;
  id?: number | string | null;
}

export interface JsonRpcSingleSuccessResponse {
  jsonrpc: "2.0";
  result: unknown;
  id: number | string | null;
}

export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
}

export interface JsonRpcSingleErrorResponse {
  jsonrpc: "2.0";
  error: {
    code: JsonRpcErrorCode | number;
    message: string;
    data?: unknown;
  };
  id: number | string | null;
}

export type JsonRpcSingleResponse =
  | JsonRpcSingleSuccessResponse
  | JsonRpcSingleErrorResponse;
export type JsonRpcBatchRequest = JsonRpcSingleRequest[];
export type JsonRpcBatchResponse = JsonRpcSingleResponse[];
export type JsonRpcRequest = JsonRpcSingleRequest | JsonRpcBatchRequest;
export type JsonRpcResponse = JsonRpcSingleResponse | JsonRpcBatchResponse;

// deno-lint-ignore ban-types
export type JsonRpcController = object;

export class JsonRpcError extends Error {
  code: number;
  data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
