# ts-passthrough-test-helper

npm install --save-dev ts-passthrough-test-helper

## Usage

Given types such as the following ( where the types of parameters and return are not important ) :

``` typescript
interface IInterface{
  methodWithReturn(p1: string): boolean;
  voidMethod(): void;

  otherMethod(): void;
}

class PassesThrough implements IInterface {
  constructor(private readonly passedTo: IInterface){}

  methodWithReturn(p1:string){
    return this.passedTo.methodWithReturn(p1);
  }
  voidMethod(){
    this.passedTo.voidMethod();
  }

  otherMethod(){
    // this will be excluded if provide the TypeInfo isValidMethod
  }
}

```

We want to test that the passedTo constructor argument is indeed used in this manner.

The tsPassThroughHelper testing framework agnostic function provides this functionality.
There are jest specific functions too.

## How it works

* Creates an object with mocked methods 
  * you determine the class or interface and which methods should passthrough
    * The typeInfo argument
      * path to the source file
      * function that finds the class or interface from the source file
        * This will default to the first type in the source file.  Alternatively there is the typeByNameFinder and the more general conditionalTypeFinder.
      * include the methods of your choice with the isValidMethod property ( otherwise all methods are included )
  * you provide the mock for each method
    * The testingFramework argument
      * get for void methods
      * getWithReturn for non void methods - **your mock method needs to return the argument**

* Passes you the mock, you return instance of the class that should pass through.
  * The passThrough argument
* It returns for each method an object with the name of the method and an execute method.

**Execution**
It calls the method on the instance you passed through with the desired number of arguments.  Each argument is of the form :
```typescript
{ arg: number} // where number is the position
```

**Expectation**
If it is a non void method and you do not return the passthrough return value then it will throw an error.
**A method will only be deemed to have a return value if it is explicitly typed**

* For all methods it will ask you to expect that the mock method has been called with the expected arguments
  * TestingFramework.expectCalledOnceWithArguments


```typescript
interface TestingFramework<TMock = any> {
    expectCalledOnceWithArguments: (mock: TMock, args: object[]) => any;

    //implement at least one of these
    get?(): TMock;
    getWithReturn?(returnValue: object): TMock;
}

type ClassOrInterface = ts.ClassDeclaration | ts.InterfaceDeclaration;
type TypeFinder = (sourceFile: ts.SourceFile) => ClassOrInterface;

export interface TypeInfo {
    filePath: string;
    typeFinder?: TypeFinder; // defaults to first class or interface
    isValidMethod?: (methodName: string) => boolean;// defaults to all methods
}

function tsPassThroughHelper(typeInfo: TypeInfo, passThrough: (mock: any) => any, testingFramework: TestingFramework): {
    methodName: string;
    execute(): void;
}[];

```

Example usage with jest :

```typescript
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
  jestPassThroughTestHelper(
    {
      filePath: 'path-to-file-only-containing-IInterface',
      isValidMethod(methodName) {
        return methodName !== 'otherMethod';
      }
    },
    mock => {
      return new PassesThrough(mock);
    }
  );
});

```