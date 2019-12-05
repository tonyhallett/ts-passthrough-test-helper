import { SomeInterface } from './interface';
export class Classs implements SomeInterface {
  public someProp!: string;
  public methodNoParametersVoid(): void {
    throw new Error('Method not implemented.');
  }
  public methodWithOneParameterReturns(p1: string): number {
    throw new Error('Method not implemented.');
  }
  public methodWithTwoParameterReturns(p1: string, p2: string): number {
    throw new Error('Method not implemented.');
  }
  public overload(): void;
  public overload(p1: string): void;
  public overload(p1: string, p2: string): void;
  public overload(p1?: any, p2?: any) {
    throw new Error('Method not implemented.');
  }
  public reverseOverload(p1: string, p2: string): void;
  public reverseOverload(p1: string): void;
  public reverseOverload(): void;
  public reverseOverload(p1?: any, p2?: any) {
    throw new Error('Method not implemented.');
  }
  public noReturn() {
    throw new Error('Method not implemented.');
  }
}
