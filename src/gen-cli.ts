import {resolve, dirname, basename, extname} from "path";
import {readFileSync, writeFileSync} from "fs";
import genAST from './genAst';
import genTS from './genTS';
import * as mkdirp from 'mkdirp';
import * as yargs from 'yargs';

const argv = yargs
    .version(function() {
        return require('../package.json').version;
    })
    .alias('v', 'version')
    .usage('Usage: $0 <command> [options]')
    .example('$0 -i ./member.thrift -o ./services -w ./request', '')
    .demandOption(['i'])
    .default('o', './services')
    .default('r', './request')
    .describe('i', 'Input thrift file path')
    .describe('o', 'Ouput typescript file folder')
    .describe('w', 'webApi or JSON-RPC request implementation file path, will be imported in generated typescript file')
    .epilog('Copyright ' + new Date().getFullYear())
    .argv;

const extName = extname(argv.i);
const inputFile = resolve(argv.i + (extName ? '' : '.thrift'));
const baseName = basename(argv.i, extName).replace('.', '');
const outputFile = extname(argv.o).replace('.', '').toLowerCase() === 'ts' ? resolve(argv.o) : resolve(argv.o, baseName + 'Service.ts');

try {
    mkdirp(resolve(dirname(outputFile)));
    const tsCode = genTS(genAST(readFileSync(inputFile).toString()), argv.w);
    writeFileSync(outputFile, tsCode);
} catch (err) {
    throw err;
}
