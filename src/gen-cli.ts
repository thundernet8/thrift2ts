import { resolve, dirname, basename, extname } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import genAST from './genAst';
import genTS from './genTS';
import genServiceClient from './genServiceClient'
import * as mkdirp from 'mkdirp';
import * as yargs from 'yargs';

const argv = yargs
    .version(function() {
        return require('../package.json').version;
    })
    .alias('v', 'version')
    .alias('c', 'clients')
    .usage('Usage: $0 <command> [options]')
    .example('$0 -i ./member.thrift -o ./services -r ./request', '')
    .demandOption(['i'])
    .default('o', './services')
    .default('r', './request')
    .default('c', false)
    .describe('i', 'Input thrift file path')
    .describe('o', 'Ouput typescript file folder')
    .describe('c', 'Whether generate thrift service clients')
    .describe('r', 'webApi or JSON-RPC request implementation file path, will be imported in generated typescript file')
    .epilog('Copyright ' + new Date().getFullYear())
    .argv;

// const extName = extname(argv.i);
// const inputFile = resolve(argv.i + (extName ? '' : '.thrift'));
// const baseName = basename(argv.i, extName).replace('.', '');
// const outputFile = extname(argv.o).replace('.', '').toLowerCase() === 'ts' ? resolve(argv.o) : resolve(argv.o, baseName + 'Service.ts');

const resolveInput = (input: string, basePath?: string) => {
    if (!input.startsWith('.')) {
        input = './' + input // thrift can include without relative path chars, e.g include "share.thrift"
    }
    const extName = extname(input);
    let paths = [basePath, input + (extName ? '' : '.thrift')];
    return resolve(...paths.filter(x => !!x));
}

const resolveOutput = (input, primary = false, isClients = false) => {
    const extName = extname(input);
    const baseName = basename(input, extName).replace('.', '');
    const outputFolder = isClients ? resolve(argv.o, 'clients') : resolve(argv.o)
    if (extname(outputFolder).replace('.', '').toLowerCase() === 'ts') {
        if (primary) {
            return resolve(outputFolder);
        } else {
            return resolve(dirname(outputFolder), baseName + (isClients ? 'Client.ts' : 'Service.ts'))
        }
    } else {
        return resolve(outputFolder, baseName + (isClients ? 'Client.ts' : 'Service.ts'));
    }
}

try {
    let gen = (() => {
        let handledFiles = [];
        let primary = true;
        const recursiveGen = (input, basePath = null, isClients = false) => {
            console.log('recursiveGen: ', isClients ? 'clients' : 'service')
            let inputFile = resolveInput(input, basePath);
            if (!basePath) {
                basePath = dirname(inputFile)
            }
            if (!existsSync(inputFile)) {
                throw new Error(`The specified file <${input}> is not exists`);
            }

            let outputFile = resolveOutput(input, primary, isClients);
            primary = false;
            if (handledFiles.indexOf(input) > -1) {
                return
            }
            handledFiles.push(input)
            mkdirp(resolve(dirname(outputFile)));

            const ast = genAST(readFileSync(inputFile).toString());
            const tsCode = isClients ? genServiceClient(ast, argv.r) : genTS(ast, argv.r);
            writeFileSync(outputFile, tsCode);
            if (ast['include']) {
                let includes: object[] = Object.keys(ast['include']).map(key => ast['include'][key]['value']);
                includes.forEach(include => {
                    recursiveGen(include, basePath, isClients);
                })
            }
        }
        return recursiveGen
    })
    gen()(argv.i)
    if (argv.c) {
        gen()(argv.i, null, true)
    }
} catch (err) {
    throw err;
}
