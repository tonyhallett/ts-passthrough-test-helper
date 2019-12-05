import { tsPassThroughHelper, TypeInfo } from './tsPassThroughHelper';

export function jestPassThroughHelper(
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

export function jestPassThroughTestHelper(
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
