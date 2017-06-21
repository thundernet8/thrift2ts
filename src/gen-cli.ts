import { resolve, dirname, basename, extname } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
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
    .example('$0 -i ./member.thrift -o ./services -r ./request', '')
    .demandOption(['i'])
    .default('o', './services')
    .default('r', './request')
    .describe('i', 'Input thrift file path')
    .describe('o', 'Ouput typescript file folder')
    .describe('r', 'webApi or JSON-RPC request implementation file path, will be imported in generated typescript file')
    .epilog('Copyright ' + new Date().getFullYear())
    .argv;

// const extName = extname(argv.i);
// const inputFile = resolve(argv.i + (extName ? '' : '.thrift'));
// const baseName = basename(argv.i, extName).replace('.', '');
// const outputFile = extname(argv.o).replace('.', '').toLowerCase() === 'ts' ? resolve(argv.o) : resolve(argv.o, baseName + 'Service.ts');

const resolveInput = (input) => {
    const extName = extname(input);
    return resolve(input + (extName ? '' : '.thrift'));
}

const resolveOutput = (input, primary = false) => {
    const extName = extname(input);
    const baseName = basename(input, extName).replace('.', '');
    if (extname(argv.o).replace('.', '').toLowerCase() === 'ts') {
        if (primary) {
            return resolve(argv.o);
        } else {
            return resolve(dirname(argv.o), baseName + 'Service.ts')
        }
    } else {
        return resolve(argv.o, baseName + 'Service.ts');
    }
}

try {
    let handledFiles = [];
    let primary = true;
    const recursiveGen = (input) => {
        let inputFile = resolveInput(input);
        if (!existsSync(inputFile)) {
            throw new Error(`The specified file <${input}> is not exists`);
        }

        let outputFile = resolveOutput(input, primary);
        primary = false;
        if (handledFiles.indexOf(input) > -1) {
            return
        }
        handledFiles.push(input)
        mkdirp(resolve(dirname(outputFile)));
        const ast = genAST(readFileSync(inputFile).toString());
        const tsCode = genTS(ast, argv.r);
        writeFileSync(outputFile, tsCode);
        if (ast['include']) {
            let includes: object[] = Object.keys(ast['include']).map(key => ast['include'][key]['value']);
            includes.forEach(include => {
                recursiveGen(include);
            })
        }
    }
    recursiveGen(argv.i)
} catch (err) {
    throw err;
}
