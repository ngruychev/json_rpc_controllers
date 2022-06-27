import {
  JsonRpcController,
  JsonRpcError,
  JsonRpcMethod,
  JsonRpcZodValidatedMethod,
} from "../../server.ts";
import { z } from "https://cdn.skypack.dev/zod@3.17.3?dts";

@JsonRpcController()
export class MyService {
  @JsonRpcMethod()
  hello(name: string) {
    return `Hello ${name}`;
  }

  @JsonRpcMethod()
  throws() {
    throw new JsonRpcError(1, "This is an error", "something went wrong");
  }

  @JsonRpcMethod()
  async slowAdd(a: number, b: number) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return a + b;
  }

  @JsonRpcZodValidatedMethod(z.tuple([z.object({
    minuend: z.number(),
    subtrahend: z.number(),
  })]))
  subtract({
    minuend,
    subtrahend,
  }: {
    minuend: number;
    subtrahend: number;
  }) {
    return minuend - subtrahend;
  }
}
