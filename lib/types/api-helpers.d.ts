import type { ValueOf } from 'type-fest'

// Copied and adapted from "openapi-typescript-fetch"

declare type Coalesce<T, D> = [T] extends [never] ? D : T

declare type OpResponseTypes<OP> = OP extends {
  responses: infer R;
} ? {
  [S in keyof R]: R[S] extends {
      schema?: infer S;
  } ? S : R[S] extends {
      content: {
          'application/json': infer C;
      };
  } ? C : S extends 'default' ? R[S] : unknown;
} : never

declare type _OpReturnType<T> = 200 extends keyof T ? T[200] : 201 extends keyof T ? T[201] : 'default' extends keyof T ? T['default'] : unknown

declare type _OpErrorType<T> = {
  [S in Exclude<keyof T, 200 | 201>]: T[S] & {
    success: false;
    status: S extends 'default' ? never : S;
  };
}

export declare type OpReturnType<OP> = { success: true, status: 200, data: _OpReturnType<OpResponseTypes<OP>> }

type OpErrorType<OP> = Coalesce<ValueOf<_OpErrorType<OpResponseTypes<OP>>>, { success: false, status: number }>
