import {resolve, dirname, basename, extname} from "path";
import {readFileSync, writeFileSync} from "fs";
import genAST from './genAst';
import genTS from './genTS';
import * as mkdirp from 'mkdirp';
import * as yargs from 'yargs';

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

const extName = extname(argv.i);
const inputFile = resolve(argv.i + extName ? '' : '.thrift');
const baseName = basename(argv.i, extName).replace('.', '');
const outputFile = resolve(dirname(argv.o), baseName + 'Service.ts');

try {
    mkdirp(resolve(dirname(argv.o)));
    const tsCode = genTS(genAST(readFileSync(inputFile).toString()), argv.w);
    writeFileSync(outputFile, tsCode);
} catch (err) {
    throw err;
}
