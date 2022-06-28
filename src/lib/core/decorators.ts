import { Ajv, AsTyped, Reflect, zod } from "../../deps.ts";

export const JSON_RPC_SERVICE_KEY = Symbol("json-rpc-service");
export const JSON_RPC_METHODS_KEY = Symbol("json-rpc-methods");
export const JSON_RPC_VALIDATOR_KEY = Symbol("json-rpc-validator");

// deno-lint-ignore no-explicit-any
type Constructor<T = unknown> = new (...args: any[]) => T;

export function JsonRpcController<T>() {
  return (target: Constructor<T>) => {
    Reflect.defineMetadata(JSON_RPC_SERVICE_KEY, true, target);
  };
}

export function JsonRpcMethod(): MethodDecorator {
  return (target, key) => {
    const methods = Reflect.getMetadata(JSON_RPC_METHODS_KEY, target) || [];
    if (!methods.includes(key)) {
      methods.push(key);
    }
    Reflect.defineMetadata(JSON_RPC_METHODS_KEY, methods, target);
  };
}

// deno-lint-ignore no-explicit-any
type Fn = (...args: any[]) => any;

// deno-lint-ignore no-explicit-any
export function JsonRpcZodValidatedMethod<T extends zod.ZodTuple<any, any>>(
  validator: T,
) {
  type X = zod.infer<typeof validator>;

  // deno-lint-ignore no-explicit-any
  return <T extends Record<string | symbol, any>, K extends string>(
    target: T,
    key: T[K] extends Fn ? Parameters<T[K]> extends X ? K : never : never,
  ) => {
    const methods = Reflect.getMetadata(JSON_RPC_METHODS_KEY, target) || [];
    if (!methods.includes(key)) {
      methods.push(key);
    }
    Reflect.defineMetadata(JSON_RPC_METHODS_KEY, methods, target);
    const validatorFn = (params: unknown) =>
      validator.safeParse(params).success;
    if (Reflect.hasMetadata(JSON_RPC_VALIDATOR_KEY, target, key)) {
      const oldValidator = Reflect.getMetadata(
        JSON_RPC_VALIDATOR_KEY,
        target,
        key,
      ) as (params: unknown) => boolean;
      Reflect.defineMetadata(
        JSON_RPC_VALIDATOR_KEY,
        (params: unknown[]) => oldValidator(params) && validatorFn(params),
        target,
        key,
      );
    } else {
      Reflect.defineMetadata(JSON_RPC_VALIDATOR_KEY, validatorFn, target, key);
    }
  };
}

export function JsonRpcAjvValidatedMethod<T>(ajv: Ajv, schema: T) {
  type X = AsTyped<typeof schema>;
  // deno-lint-ignore no-explicit-any
  return <T extends Record<string | symbol, any>, K extends string>(
    target: T,
    key: T[K] extends Fn ? Parameters<T[K]> extends X ? K : never : never,
  ) => {
    const methods = Reflect.getMetadata(JSON_RPC_METHODS_KEY, target) || [];
    if (!methods.includes(key)) {
      methods.push(key);
    }
    Reflect.defineMetadata(JSON_RPC_METHODS_KEY, methods, target);
    const compiledSchema = ajv.compile(schema);
    const validatorFn = (params: unknown) => compiledSchema(params);
    if (Reflect.hasMetadata(JSON_RPC_VALIDATOR_KEY, target, key)) {
      const oldValidator = Reflect.getMetadata(
        JSON_RPC_VALIDATOR_KEY,
        target,
        key,
      ) as (params: unknown) => boolean;
      Reflect.defineMetadata(
        JSON_RPC_VALIDATOR_KEY,
        (params: unknown) => oldValidator(params) && validatorFn(params),
        target,
        key,
      );
    } else {
      Reflect.defineMetadata(JSON_RPC_VALIDATOR_KEY, validatorFn, target, key);
    }
  };
}
