import * as fs from 'fs';
import * as ts from 'typescript';
export interface PassthroughMethodInfo {
  name: string;
  numParameters: number;
  isVoid: boolean;
}
export type ClassOrInterface = ts.ClassDeclaration | ts.InterfaceDeclaration;
// tslint:disable-next-line: only-arrow-functions
export const getPassThroughMethodInfos = function(
  classOrInterface: ClassOrInterface,
  sourceFile: ts.SourceFile,
  validMethod: (methodName: string) => boolean
): PassthroughMethodInfo[] {
  const methodInfoMap: Map<string, PassthroughMethodInfo> = new Map();
  classOrInterface.members.forEach((m: ts.ClassElement | ts.TypeElement) => {
    if (ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) {
      let addMethod = true;
      const name = m.name.getText(sourceFile);
      if (validMethod(name)) {
        const numParameters = m.parameters.length;
        if (methodInfoMap.has(name)) {
          if (methodInfoMap.get(name)!.numParameters > numParameters) {
            addMethod = false;
          }
        }
        if (addMethod) {
          methodInfoMap.set(name, {
            isVoid: m.type?.kind === ts.SyntaxKind.VoidKeyword,
            name,
            numParameters: m.parameters.length
          });
        }
      }
    }
  });
  return Array.from(methodInfoMap.values());
};

// tslint:disable-next-line: only-arrow-functions
export const generateMock = function(
  methodInfos: PassthroughMethodInfo[],
  mockCreator: TestingFramework
) {
  const mock = {} as any;
  const mockReturn = {};
  methodInfos.forEach(mi => {
    let mockMethod: any;
    if (mi.isVoid) {
      if (mockCreator.get) {
        mockMethod = mockCreator.get();
      } else {
        throw new MissingMockCreatorMethod(true);
      }
    } else {
      if (mockCreator.getWithReturn) {
        mockMethod = mockCreator.getWithReturn(mockReturn);
      } else {
        throw new MissingMockCreatorMethod(false);
      }
    }
    mock[mi.name] = mockMethod;
  });
  return { mock, mockReturn };
};
/* istanbul ignore next */
// tslint:disable-next-line: only-arrow-functions
export const createSourceFileFromPath = function(sourcePath: string) {
  return ts.createSourceFile(
    '',
    readSourceFile(sourcePath),
    ts.ScriptTarget.ES2015
  );
};
/* istanbul ignore next */
export function readSourceFile(filePath: string) {
  return fs.readFileSync(filePath).toString();
}

export type TypeFinder = (sourceFile: ts.SourceFile) => ClassOrInterface;

export const conditionalTypeFinder: (
  predicate: (classOrInterface: ClassOrInterface) => boolean
) => TypeFinder = (
  predicate: (classOrInterface: ClassOrInterface) => boolean
) => (sourceFile: ts.SourceFile) => {
  const visitor: any = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      const match = predicate(node);
      if (match) {
        return node;
      }
    }

    return ts.forEachChild(node, visitor);
  };
  /*
    If a callback returns a truthy value, iteration stops and that value is returned. Otherwise, undefined is returned.
  */
  const classOrInterface: ClassOrInterface | undefined = ts.forEachChild(
    sourceFile,
    visitor
  );
  if (!classOrInterface) {
    throw new Error();
  }
  return classOrInterface!;
};

export const firstTypeFinder: TypeFinder = conditionalTypeFinder(() => true);
export const typeByNameFinder: (name: string) => TypeFinder = (
  typeName: string
) =>
  conditionalTypeFinder(
    classOrInterface => classOrInterface.name?.text === typeName
  );
/* istanbul ignore next */
export const allMethodsValid = () => true;
// tslint:disable-next-line: only-arrow-functions
export const defaultIsValidMethodToAll = function(
  isValidMethod: ((methodName: string) => boolean) | undefined
) {
  if (isValidMethod) {
    return isValidMethod;
  }
  return allMethodsValid;
};
// tslint:disable-next-line: only-arrow-functions
export const defaultTypeFinderToFirstType = function(
  typeFinder: TypeFinder | undefined
) {
  if (typeFinder) {
    return typeFinder;
  }
  return firstTypeFinder;
};
// tslint:disable-next-line: only-arrow-functions
export const getMethodInfos = function(typeInfo: TypeInfo) {
  const isValidMethod = defaultIsValidMethodToAll(typeInfo.isValidMethod);
  const typeFinder = defaultTypeFinderToFirstType(typeInfo.typeFinder);

  const sourceFile = createSourceFileFromPath(typeInfo.filePath);
  const classOrInterface = typeFinder(sourceFile);

  const methodInfos = getPassThroughMethodInfos(
    classOrInterface,
    sourceFile,
    isValidMethod
  );
  return methodInfos;
};

export interface TestingFramework<TMock = any> {
  expectCalledOnceWithArguments: (mock: TMock, args: object[]) => any;

  get?: () => TMock;
  getWithReturn?: (returnValue: object) => TMock;
}

export interface TypeInfo {
  filePath: string;
  typeFinder?: TypeFinder;
  isValidMethod?: (methodName: string) => boolean;
}
export function tsPassThroughHelper<TMock = any>(
  typeInfo: TypeInfo,
  passThrough: (mock: any) => any,
  testingFramework: TestingFramework<TMock>
) {
  const methodInfos = getMethodInfos(typeInfo);

  const { mock, mockReturn } = generateMock(methodInfos, testingFramework);

  const usesMock = passThrough(mock);
  return methodInfos.map(mi => {
    const methodName = mi.name;
    return {
      methodName,
      execute() {
        // tslint:disable-next-line: ban-types
        const method: Function = usesMock[methodName];
        const args = [];
        for (let i = 0; i < mi.numParameters; i++) {
          args.push({ arg: i });
        }
        const returnValue = method.call(usesMock, ...args);
        if (!mi.isVoid && returnValue !== mockReturn) {
          throw new DidNotReturnFromPassThroughError();
        }
        testingFramework.expectCalledOnceWithArguments(mock[mi.name], args);
      }
    };
  });
}
export class DidNotReturnFromPassThroughError extends Error {
  constructor() {
    super('Did not return passthrough return value');
  }
}

export class MissingMockCreatorMethod extends Error {
  constructor(public readonly missingGet: boolean) {
    super(
      `You did not supply the ${missingGet ? 'get' : 'getWithReturn'} method`
    );
  }
}
