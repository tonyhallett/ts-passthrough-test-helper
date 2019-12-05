import * as path from 'path';
import { IInterface } from '../__tests_types/exampleUsage';
import { tsPassThroughHelper, TypeInfo } from '../src/index';

class PassesThrough implements IInterface {
  constructor(private readonly passedTo: IInterface) {}

  public methodWithReturn(p1: string) {
    return this.passedTo.methodWithReturn(p1);
  }
  public voidMethod() {
    this.passedTo.voidMethod();
  }

  public otherMethod() {
    // this will be excluded if provide the TypeInfo isValidMethod
  }
}

function jestPassThroughHelper(
  typeInfo: TypeInfo,
  passThrough: (mock: any) => any
) {
  return tsPassThroughHelper(typeInfo, passThrough, {
    get() {
      return jest.fn();
    },
    getWithReturn(returnValue) {
      return jest.fn().mockReturnValue(returnValue);
    },
    expectCalledOnceWithArguments(mock, args) {
      expect(mock).toHaveBeenCalledWith(...args);
    }
  });
}
function jestPassThroughTestHelper(
  typeInfo: TypeInfo,
  passThrough: (mock: any) => any
) {
  const tests = jestPassThroughHelper(typeInfo, passThrough);
  tests.forEach(t => {
    it(`should passthrough ${t.methodName}`, () => {
      t.execute();
    });
  });
}
describe('passes through', () => {
  const filePath = path.join(
    __dirname,
    '..',
    '__tests_types',
    'exampleUsage.ts'
  );
  jestPassThroughTestHelper(
    {
      filePath,
      isValidMethod(methodName) {
        return methodName !== 'otherMethod';
      }
    },
    mock => {
      return new PassesThrough(mock);
    }
  );
});
