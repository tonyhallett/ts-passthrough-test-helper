export interface SomeInterface {
  someProp: string;
  methodNoParametersVoid(): void;
  methodWithOneParameterReturns(p1: string): number;
  methodWithTwoParameterReturns(p1: string, p2: string): number;

  overload(): void;
  overload(p1: string): void;
  overload(p1: string, p2: string): void;

  reverseOverload(p1: string, p2: string): void;
  reverseOverload(p1: string): void;
  reverseOverload(): void;

  // @ts-ignore
  noReturn();
}
