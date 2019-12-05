import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { PassTo } from '../__tests_types/integration';
import * as Helper from '../src/tsPassThroughHelper';

function noop() {
  /* noop */
}

describe('helper', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function getSourceFilePath(fileName: string) {
    return path.join(__dirname, '..', '__tests_types', fileName);
  }
  function createSourceFileFromFileName(fileName: string) {
    function readSourceFile(filePath: string) {
      return fs.readFileSync(filePath).toString();
    }
    return ts.createSourceFile(
      '',
      readSourceFile(getSourceFilePath(fileName)),
      ts.ScriptTarget.ES2015
    );
  }

  const typeFinder: Helper.TypeFinder = (sourceFile: ts.SourceFile) => {
    let declaration: ts.InterfaceDeclaration | ts.ClassDeclaration;
    ts.forEachChild(sourceFile, node => {
      if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
        declaration = node;
        return declaration;
      }
    });
    return declaration!;
  };

  ['interface.d.ts', 'class.ts'].forEach(p => {
    function getDeclarationAndSourceFile(fileName: string) {
      const sourceFile = createSourceFileFromFileName(fileName);

      return {
        declaration: typeFinder(sourceFile),
        sourceFile
      };
    }

    describe('getPassThroughMethodInfos', () => {
      const { sourceFile, declaration } = getDeclarationAndSourceFile(p);

      describe('should add valid methods', () => {
        const methods = [
          'methodWithOneParameterReturns',
          'methodNoParametersVoid'
        ];
        methods.forEach(m => {
          it('should have name ${m}', () => {
            const mis = Helper.getPassThroughMethodInfos(
              declaration,
              sourceFile,
              methodName => methodName === m
            );
            expect(mis.length).toBe(1);
            expect(mis[0].name).toBe(m);
          });
        });
        interface VoidTest {
          methodName: string;
          expectedVoid: boolean;
        }
        const voidTests: VoidTest[] = [
          {
            expectedVoid: true,
            methodName: 'methodNoParametersVoid'
          },
          {
            expectedVoid: false,
            methodName: 'methodWithOneParameterReturns'
          },
          {
            expectedVoid: false,
            methodName: 'noReturn'
          }
        ];
        voidTests.forEach(t => {
          it(`should have if void - ${t.expectedVoid}`, () => {
            const mis = Helper.getPassThroughMethodInfos(
              declaration,
              sourceFile,
              methodName => methodName === t.methodName
            );
            expect(mis[0].isVoid).toBe(t.expectedVoid);
          });
        });

        interface NumParamsTest {
          methodName: string;
          expectedNumParams: number;
        }
        const numParamsTests: NumParamsTest[] = [
          {
            expectedNumParams: 0,

            methodName: 'methodNoParametersVoid'
          },
          {
            expectedNumParams: 1,
            methodName: 'methodWithOneParameterReturns'
          }
        ];
        numParamsTests.forEach(t => {
          it(`should have the number of parameters - ${t.expectedNumParams}`, () => {
            const mis = Helper.getPassThroughMethodInfos(
              declaration,
              sourceFile,
              methodName => methodName === t.methodName
            );
            expect(mis[0].numParameters).toBe(t.expectedNumParams);
          });
        });
      });

      it('should not add overloads with less parameters', () => {
        const mis = Helper.getPassThroughMethodInfos(
          declaration,
          sourceFile,
          methodName => methodName === 'reverseOverload'
        );
        expect(mis[0].numParameters).toBe(2);
      });

      it('should overwrite overloads with more parameters', () => {
        const mis = Helper.getPassThroughMethodInfos(
          declaration,
          sourceFile,
          methodName => methodName === 'overload'
        );
        expect(mis[0].numParameters).toBe(2);
      });
    });
  });

  describe('generate mock', () => {
    describe('should have a mock method for each method', () => {
      it('should come from get if void', () => {
        const mockFn = jest.fn();
        const mockMockCreator = {
          get() {
            return mockFn;
          },
          getWithReturn: noop
        };
        const { mock } = Helper.generateMock(
          [{ name: 'voidMethod', isVoid: true, numParameters: 0 }],
          mockMockCreator as any
        );
        expect(mock.voidMethod).toBe(mockFn);
      });

      it('should come from getWithReturn if non void', () => {
        const mockFn = jest.fn();
        const mockMockCreator = {
          get: noop,
          getWithReturn() {
            return mockFn;
          }
        };
        const { mock } = Helper.generateMock(
          [{ name: 'nonVoidMethod', isVoid: false, numParameters: 0 }],
          mockMockCreator as any
        );
        expect(mock.nonVoidMethod).toBe(mockFn);
      });
    });

    it('should return the mockReturn object used for each mocked return method', () => {
      let mockReturnValue: object;
      const mockMockCreator = {
        get: noop,
        getWithReturn(returnValue: object) {
          mockReturnValue = returnValue;
        }
      };
      const { mockReturn } = Helper.generateMock(
        [{ name: 'NonVoidMethod', isVoid: false, numParameters: 0 }],
        mockMockCreator as any
      );
      expect(mockReturn).toBe(mockReturnValue!);
    });
    it('should throw MissingMockCreatorMethod if void method and no get', () => {
      const mockMockCreator = {
        getWithReturn: noop
      };
      expect(() =>
        Helper.generateMock(
          [{ name: 'voidMethod', isVoid: true, numParameters: 0 }],
          mockMockCreator as any
        )
      ).toThrowError('You did not supply the get method');
    });
    it('should throw MissingMockCreatorMethod if non void method and no getWithReturn', () => {
      const mockMockCreator = {
        get: noop
      };
      expect(() =>
        Helper.generateMock(
          [{ name: 'nonVoidMethod', isVoid: false, numParameters: 0 }],
          mockMockCreator as any
        )
      ).toThrowError('You did not supply the getWithReturn method');
    });
  });
  describe('getMethodInfos', () => {
    it('should use the ( defaulted ) type finder and ( defaulted isValidMethodInfo ) on the source file from path', () => {
      const mockDefaultedIsValidMethod = () => true;
      const spiedDefaultIsValidMethodToAll = jest
        .spyOn(Helper, 'defaultIsValidMethodToAll')
        .mockReturnValue(mockDefaultedIsValidMethod);

      const type = {};
      const mockTypeFinder = jest.fn().mockReturnValue(type);
      const spiedDefaultTypeFinderToFirstType = jest
        .spyOn(Helper, 'defaultTypeFinderToFirstType')
        .mockReturnValue(mockTypeFinder);

      const mockSourceFile = {};
      const spiedCreateSourceFileFromPath = jest
        .spyOn(Helper, 'createSourceFileFromPath')
        .mockReturnValue(mockSourceFile as any);
      const mockMethodInfos: any[] = [];
      const spiedGetPassThroughMethodInfos = jest
        .spyOn(Helper, 'getPassThroughMethodInfos')
        .mockReturnValue(mockMethodInfos);

      const typeInfo = {
        filePath: 'somePath',
        isValidMethod: () => true,
        typeFinder: mockTypeFinder
      };
      const methodInfos = Helper.getMethodInfos(typeInfo);

      expect(methodInfos).toBe(mockMethodInfos);
      expect(spiedCreateSourceFileFromPath).toHaveBeenCalledWith('somePath');
      expect(spiedDefaultIsValidMethodToAll.mock.calls[0][0]).toBe(
        typeInfo.isValidMethod
      );
      expect(spiedDefaultTypeFinderToFirstType.mock.calls[0][0]).toBe(
        typeInfo.typeFinder
      );
      expect(mockTypeFinder.mock.calls[0][0]).toBe(mockSourceFile);
      const getPassThroughMethodInfosArgs =
        spiedGetPassThroughMethodInfos.mock.calls[0];
      expect(getPassThroughMethodInfosArgs[0]).toBe(type);
      expect(getPassThroughMethodInfosArgs[1]).toBe(mockSourceFile);
      expect(getPassThroughMethodInfosArgs[2]).toBe(mockDefaultedIsValidMethod);
    });
    describe('default typeInfo', () => {
      describe('defaultTypeFinderToFirstType', () => {
        it('should return the TypeInfo.TypeFinder if present', () => {
          const definedTypeFinder = noop as any;
          const defaulted = Helper.defaultTypeFinderToFirstType(
            definedTypeFinder
          );
          expect(defaulted).toBe(definedTypeFinder);
        });
        it('should default to firstTypeFinder', () => {
          const defaulted = Helper.defaultTypeFinderToFirstType(undefined);
          expect(defaulted).toBe(Helper.firstTypeFinder);
        });
      });
      describe('defaultIsValidMethodToAll', () => {
        it('should return the TypeInfo.isValidMethod if present', () => {
          const isValidMethod = noop as any;
          const defaulted = Helper.defaultIsValidMethodToAll(isValidMethod);
          expect(defaulted).toBe(isValidMethod);
        });
        it('should default to all', () => {
          const defaulted = Helper.defaultIsValidMethodToAll(undefined);
          expect(defaulted).toBe(Helper.allMethodsValid);
        });
      });
    });
  });

  describe('type finders', () => {
    const sourceFile = createSourceFileFromFileName('typeFinder.ts');
    describe('conditionalTypeFinder', () => {
      it('should keep calling the predicate until matches', () => {
        let predicateCount = 0;
        const notFirstTypeFinder = Helper.conditionalTypeFinder(
          classOrInterface => {
            predicateCount++;
            return classOrInterface.name?.text === 'NotFirst';
          }
        );
        const notFirstInterface = notFirstTypeFinder(sourceFile);
        expect(notFirstInterface.name!.text).toBe('NotFirst');
        expect(predicateCount).toBe(3);
      });
      it('should throw error if does not match', () => {
        const notFindingTypeFinder = Helper.conditionalTypeFinder(
          classOrInterface => false
        );
        expect(() => notFindingTypeFinder(sourceFile)).toThrow();
      });
    });
    describe('typeByNameFinder', () => {
      it('should find by name', () => {
        const typeByName = Helper.typeByNameFinder('Last')(sourceFile);
        expect(typeByName.name?.text).toBe('Last');
      });
    });
    describe('firstTypeFinder', () => {
      it('should return the first type', () => {
        const firstInterface = Helper.firstTypeFinder(sourceFile);
        expect(firstInterface.name?.text).toBe('First');
      });
    });
  });

  describe('logic', () => {
    it('should get method infos using the TypeInfo', () => {
      const spiedGetMethodInfos = jest
        .spyOn(Helper, 'getMethodInfos')
        .mockReturnValue([]);
      const typeInfo = {};
      Helper.tsPassThroughHelper(typeInfo as any, noop, {} as any);
      expect(spiedGetMethodInfos.mock.calls[0][0]).toBe(typeInfo);
    });

    it('should generate mock using the method infos and the TestingFramework', () => {
      const methodInfos: any[] = [];
      jest.spyOn(Helper, 'getMethodInfos').mockReturnValue(methodInfos);
      const spiedGenerateMock = jest
        .spyOn(Helper, 'generateMock')
        .mockReturnValue({} as any);
      const testingFramework = {};
      Helper.tsPassThroughHelper({} as any, noop, testingFramework as any);
      const generateMockArgs = spiedGenerateMock.mock.calls[0];
      expect(generateMockArgs[0]).toBe(methodInfos);
      expect(generateMockArgs[1]).toBe(testingFramework);
    });

    it('should passthrough the mock', () => {
      jest.spyOn(Helper, 'getMethodInfos').mockReturnValue([]);
      const mock = {};
      jest.spyOn(Helper, 'generateMock').mockReturnValue({ mock } as any);
      const passthrough = jest.fn();
      Helper.tsPassThroughHelper(
        undefined as any,
        passthrough,
        undefined as any
      );
      expect(passthrough.mock.calls[0][0]).toBe(mock);
    });

    it('should return object with method name property for each method info', () => {
      const methodInfos = [{ name: 'method1' }, { name: 'method2' }];
      jest.spyOn(Helper, 'getMethodInfos').mockReturnValue(methodInfos as any);
      jest.spyOn(Helper, 'generateMock').mockReturnValue({} as any);
      const passthrough = jest.fn();
      const executeMethods = Helper.tsPassThroughHelper(
        undefined as any,
        passthrough,
        undefined as any
      );
      expect(executeMethods[0].methodName).toBe('method1');
      expect(executeMethods[1].methodName).toBe('method2');
    });

    describe('execute', () => {
      it('should call the associated method on the passing through instance with correct number of args', () => {
        const usesMock = {
          method1: jest.fn(),
          method2: jest.fn()
        };
        interface MethodInfo {
          name: keyof typeof usesMock;
          numParameters: number;
        }
        const methodInfos: MethodInfo[] = [
          { name: 'method1', numParameters: 1 },
          { name: 'method2', numParameters: 2 }
        ];
        jest
          .spyOn(Helper, 'getMethodInfos')
          .mockReturnValue(methodInfos as any);
        const mock = {};
        jest.spyOn(Helper, 'generateMock').mockReturnValue({ mock } as any);

        const executeMethods = Helper.tsPassThroughHelper(
          undefined as any,
          () => usesMock,
          { expectToBe: noop, expectCalledOnceWithArguments: noop } as any
        );
        executeMethods[0].execute();
        executeMethods[1].execute();
        function expectCallArgs(methodInfo: MethodInfo) {
          const args = usesMock[methodInfo.name].mock.calls[0];
          expect(args.length).toBe(methodInfo.numParameters);
          for (let i = 0; i < methodInfo.numParameters; i++) {
            const arg = args[i];
            expect(arg).toEqual({ arg: i });
          }
        }
        expectCallArgs(methodInfos[0]);
        expectCallArgs(methodInfos[1]);
      });
      describe('throws error if do not return passthrough return', () => {
        interface ReturnTest {
          description: string;
          returnFromPassthrough: boolean;
          expectError: boolean;
        }
        const returnTests: ReturnTest[] = [
          {
            description:
              'should not throw error if non void return method returns from passthrough',
            expectError: false,
            returnFromPassthrough: true
          },
          {
            description:
              'should throw error if non void return method does not return from passthrough',
            expectError: true,
            returnFromPassthrough: false
          }
        ];
        returnTests.forEach(t => {
          it(t.description, () => {
            const mock = {};
            const mockReturn = {};
            jest
              .spyOn(Helper, 'generateMock')
              .mockReturnValue({ mock, mockReturn });
            const usesMock = {
              nonVoid() {
                if (t.returnFromPassthrough) {
                  return mockReturn;
                } else {
                  return 'something else';
                }
              }
            };
            interface MethodInfo {
              name: keyof typeof usesMock;
              numParameters: 0;
              isVoid: false;
            }
            const methodInfos: MethodInfo[] = [
              { name: 'nonVoid', numParameters: 0, isVoid: false }
            ];
            jest
              .spyOn(Helper, 'getMethodInfos')
              .mockReturnValue(methodInfos as any);

            const executeMethods = Helper.tsPassThroughHelper(
              undefined as any,
              () => usesMock,
              { expectCalledOnceWithArguments: noop } as any
            );
            let executeError: Error | undefined;
            try {
              executeMethods[0].execute();
            } catch (e) {
              executeError = e;
            }
            if (t.expectError) {
              expect(executeError!.message).toBe(
                'Did not return passthrough return value'
              );
            } else {
              expect(executeError).toBeUndefined();
            }
          });
        });
      });

      it('should call TestingFramework.expectCalledOnceWithArguments for each method with the mock and the call args', () => {
        const usesMock = {
          noParams: noop,
          oneParam: noop,
          twoParams: noop
        };
        interface MethodInfo {
          name: keyof typeof usesMock;
          numParameters: number;
          isVoid: true;
        }
        const methodInfos: MethodInfo[] = [
          { name: 'noParams', numParameters: 0, isVoid: true },
          { name: 'oneParam', numParameters: 1, isVoid: true },
          { name: 'twoParams', numParameters: 2, isVoid: true }
        ];
        jest
          .spyOn(Helper, 'getMethodInfos')
          .mockReturnValue(methodInfos as any);
        const mockNoParams = jest.fn();
        const mockOneParam = jest.fn();
        const mockTwoParams = jest.fn();
        const mock: typeof usesMock = {
          noParams: mockNoParams,
          oneParam: mockOneParam,
          twoParams: mockTwoParams
        };
        jest
          .spyOn(Helper, 'generateMock')
          .mockReturnValue({ mock, mockReturn: {} } as any);
        const testingFramework = {
          expectCalledOnceWithArguments: jest.fn()
        };

        const executeMethods = Helper.tsPassThroughHelper(
          undefined as any,
          () => usesMock,
          testingFramework as any
        );
        executeMethods[0].execute();
        expect(
          testingFramework.expectCalledOnceWithArguments
        ).toHaveBeenCalledWith(mockNoParams, []);
        executeMethods[1].execute();
        expect(
          testingFramework.expectCalledOnceWithArguments
        ).toHaveBeenCalledWith(mockOneParam, [{ arg: 0 }]);
        executeMethods[2].execute();
        expect(
          testingFramework.expectCalledOnceWithArguments
        ).toHaveBeenCalledWith(mockTwoParams, [{ arg: 0 }, { arg: 1 }]);
      });
    });
  });

  describe('integration', () => {
    interface IntegrationTest {
      passToMethodName: keyof PassTo;
      expectFailure: boolean;
      description: string;
    }
    const integrationTests: IntegrationTest[] = [
      {
        description: 'should fail expectation if does not return',
        expectFailure: true,
        passToMethodName: 'hasReturn'
      },
      {
        description: 'should pass expectation if does return',
        expectFailure: false,
        passToMethodName: 'hasReturn'
      },
      {
        description:
          'should fail expectation if does not pass through arguments',
        expectFailure: true,
        passToMethodName: 'hasParam'
      },
      {
        description: 'should pass expectation if does pass through arguments',
        expectFailure: false,
        passToMethodName: 'hasParam'
      },
      {
        description:
          'should fail expectation if does not call passthrough ( no args )',
        expectFailure: true,
        passToMethodName: 'noParams'
      },
      {
        description:
          'should pass expectation if does call passthrough ( no args )',
        expectFailure: false,
        passToMethodName: 'noParams'
      }
    ];
    integrationTests.forEach(test => {
      it(test.description, () => {
        const passesThroughCorrectly = !test.expectFailure;
        class PassesThrough implements PassTo {
          constructor(private readonly passTo: PassTo) {}
          public noParams(): void {
            if (passesThroughCorrectly) {
              this.passTo.noParams();
            }
          }
          public hasParam(p1: string): void {
            if (passesThroughCorrectly) {
              this.passTo.hasParam(p1);
            } else {
              this.passTo.hasParam('something else');
            }
          }
          public hasReturn(): string {
            if (passesThroughCorrectly) {
              return this.passTo.hasReturn();
            }
            return 'something else';
          }
        }
        let failed = false;
        const testingFramework: Helper.TestingFramework<jest.Mock> = {
          get() {
            return jest.fn();
          },
          getWithReturn(returnValue) {
            return jest.fn().mockReturnValue(returnValue);
          },
          expectCalledOnceWithArguments(mock, args) {
            try {
              expect(mock).toHaveBeenCalledWith(...args);
            } catch (e) {
              failed = true;
            }
          }
        };
        const typeInfo: Helper.TypeInfo = {
          isValidMethod(methodName) {
            return methodName === test.passToMethodName;
          },
          filePath: getSourceFilePath('integration.ts'),
          typeFinder
        };
        const executeMethods = Helper.tsPassThroughHelper(
          typeInfo,
          mock => new PassesThrough(mock),
          testingFramework
        );
        try {
          executeMethods[0].execute();
        } catch (e) {
          failed = test.expectFailure;
        }
        expect(failed).toBe(test.expectFailure);
      });
    });
  });
});
