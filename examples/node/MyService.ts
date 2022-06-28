import {
  JsonRpcAjvValidatedMethod,
  JsonRpcController,
  JsonRpcError,
  JsonRpcMethod,
  JsonRpcZodValidatedMethod,
} from "@ngruychev/json_rpc_controllers/server";
import Ajv from "ajv";
import { z } from "zod";

const schema = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        minuend: {
          type: "number",
        },
        subtrahend: {
          type: "number",
        },
      },
      required: ["minuend", "subtrahend"],
    },
  ],
} as const;

const ajv = new Ajv();

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
  @JsonRpcAjvValidatedMethod(ajv, schema)
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
