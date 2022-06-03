import {
  JsonRpcController,
  JsonRpcMethod,
  JsonRpcValidatedMethod,
  JsonRpcError,
} from "https://deno.land/x/json_rpc_controllers@0.0.5/server.ts";

@JsonRpcController
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

  @JsonRpcValidatedMethod((z) =>
    z.tuple([z.object({
      minuend: z.number(),
      subtrahend: z.number(),
    })])
  )
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
