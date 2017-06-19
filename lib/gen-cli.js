"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_1 = require("fs");
const genAst_1 = require("./genAst");
const genTS_1 = require("./genTS");
const mkdirp = require("mkdirp");
const yargs = require("yargs");
const argv = yargs
    .usage('Usage: $0 <command> [options]')
    .example('$0 -i ./member.thrift -o ./services -w ./webApi', '')
    .demandOption(['i', 'o'])
    .default('w', './webApi')
    .describe('i', 'Input thrift file path')
    .describe('o', 'Ouput typescript file folder')
    .describe('w', 'Typescript import webApi file path')
    .epilog('Copyright 2017')
    .argv;
const extName = path_1.extname(argv.i);
const inputFile = path_1.resolve(argv.i + extName ? '' : '.thrift');
const baseName = path_1.basename(argv.i, extName).replace('.', '');
const outputFile = path_1.resolve(path_1.dirname(argv.o), baseName + 'Service.ts');
try {
    mkdirp(path_1.resolve(path_1.dirname(argv.o)));
    const tsCode = genTS_1.default(genAst_1.default(fs_1.readFileSync(inputFile).toString()), argv.w);
    fs_1.writeFileSync(outputFile, tsCode);
}
catch (err) {
    throw err;
}
