## Thrift2TS

Parse Thrift (IDL) to TypeScript.

## Install

npm
```
npm install thrift2ts -g
```

yarn
```
yarn add thrift2ts
```

## Usage

### CLI
```
thrift2ts -i [thrift file path] -o [typescript file output folder] -w [webApi import path]
```

sample
```
thrift2ts -i ./common.thrift -o ./services -w ./webApi
```

### normal package
```
var thrift2ts = require('thrift2ts');
var thriftCode = 'XXX';

var tsCode = thrift2ts(thriftCode, './webApi')
```

## Example


## Issues

### Why webApi

Thrift service will exploded into functions which are for RPC call, a common API request instance is required, and accept method string, POST data as parameters. We donnot concern about which request approach(AJAX, Fetch) or libraries(axios, jQuery, fetch-io) you'd like to use, but you must provide the webApi implementation file path for importing.