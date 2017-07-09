[中文说明](./README-CN.md)

## Thrift2TS

Parse Thrift (IDL) to TypeScript, which could be used as typed interface docs for FrontEnd.

Also as an option, Thrift service clients could be generated. With these clients, a complete RPC call with Thrift data transport and protocol could be done.

This make up some issues on thrift officially generated RPC service clients for browser javascript app:

    * add sequence support for RPC client so that it can reuse the Websocket connection without incorrect response callback order

    * moduled script file, easy to import and package, rather than many global variables in official generated client for browser
    
    * all generated TypeScript files introduce types support and result in more convenient development of your app

[Thrift Doc](https://thrift.apache.org/docs/idl)

[TypeScript Doc](https://www.typescriptlang.org/docs/home.html)

## Install

npm
```
npm install thrift2ts -g
```

yarn
```
yarn global add thrift2ts
```

## Usage

### CLI
```
t2t -i [thrift file path] -o [typescript file output folder] -r [request method import path] -c
```

sample
```
t2t -i ./common.thrift -o ./services -r ./request -c
```

### normal package
```
var thrift2ts = require('thrift2ts').default;
var thriftCode = 'XXX';

var tsCode = thrift2ts(thriftCode, './request')
```

## Example

Thrift

```
namespace java com.company.javabusz
namespace go com.company.gobusz

include "./Common.thrift"

enum EmployeeType {
	Junior = 0,
	Senior = 1,
	Manager,
	Director = 0xa
}

struct Employee {
	1:required string name;
	2:optional i32 age;
	3:required map<string, i32> tasks;
}

exception NetworkException {
	1:required i32 code;
	2:required string message;
	3:optional string url;
}

const i32 year = 2017

const list<string> languages = ['Java', 'Go', 'JavaScript']

const map<string, i32> lanAges = {'Java': 20, 'Go': 8, 'JavaScript': 16}

const bool happy = true

// This is a map definition
typedef map<string, number> EmployeesCatlog // a tail comment

service EmployeeOperator {
	list<Employee> QueryEmployee(1:i32 age)
}

service EmployeeSalaryOperator extends EmployeeOperator {
	bool OperateEmployeeSalaryByType(1:EmployeeType type, 2:i64 amount, 2:string note);
}
```
Convert to TypeScript

```
/**
 * Auto generated by Thrift2Ts.
 *
 * Mon Jun 19 2017 22:42:06 GMT+0800 (CST)
 */

import Request from "./request";

import * as Common from "./CommonService";

export const year: number = 2017; 

export const languages: string[] = ["Java", "Go", "JavaScript"]; 

export const lanAges: {[key: string]: number} = {"Java": 20, "Go": 8, "JavaScript": 16}; 

export const happy: boolean = true; 

export enum EmployeeType {
    Junior = 0,
    Senior = 1,
    Manager = 2,
    Director = 10
}

export interface NetworkException {
    code: number;
    message: string;
    url?: string;
}

export interface Employee {
    name: string;
    age?: number;
    tasks: {[key: string]: number};
}

export function QueryEmployee(age: number): Promise<Employee[]> {
    return Request<Employee[]>("EmployeeOperator.QueryEmployee", { age })
}

export function OperateEmployeeSalaryByType(type: EmployeeType, amount: number, note: string): Promise<boolean> {
    return Request<boolean>("EmployeeSalaryOperator.OperateEmployeeSalaryByType", { type, amount, note })
}


export default {
    QueryEmployee,
    OperateEmployeeSalaryByType
}

```

## Issues

### Why import Request

Thrift service will exploded into functions which are used for RPC-liked call or webApi request, a common request instance is required, and accept method string, POST data as parameters. We donnot concern about which request approach(AJAX, Fetch) or libraries(axios, jQuery, fetch-io) you'd like to use, but you must provide the request implementation file path for importing.

Please find the examples in sample folder.

##### Using normal text transport without thrift rpc server

 * [HTTP-RPC-Request](./sample/rpc-request.ts)

 * [HTTP-API-Request](./sample/webApi-request.ts)

##### Using thrift data transport protocol with thrift rpc server

 * [Thrift-RPC-Request WebSocket connection](./templates/thrift-ws-request.ts)

 * [Thrift-RPC-Request XHR connection](./templates/thrift-xhr-request.ts)


### Requirements

You need import [Browser Thrift](https://www.npmjs.com/package/browser-thrift2) package when trying to communicate with a Thrift RPC server, which defines the thrift data transport protocol.

Also you could find a demo in this package's introduction.
