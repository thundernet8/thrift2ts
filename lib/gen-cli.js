"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_1 = require("fs");
const genAst_1 = require("./genAst");
const genServiceClient_1 = require("./genServiceClient");
const mkdirp = require("mkdirp");
const yargs = require("yargs");
const argv = yargs
    .version(function () {
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
const resolveInput = (input, basePath) => {
    if (!input.startsWith('.')) {
        input = './' + input;
    }
    const extName = path_1.extname(input);
    let paths = [basePath, input + (extName ? '' : '.thrift')];
    return path_1.resolve(...paths.filter(x => !!x));
};
const resolveOutput = (input, primary = false) => {
    const extName = path_1.extname(input);
    const baseName = path_1.basename(input, extName).replace('.', '');
    if (path_1.extname(argv.o).replace('.', '').toLowerCase() === 'ts') {
        if (primary) {
            return path_1.resolve(argv.o);
        }
        else {
            return path_1.resolve(path_1.dirname(argv.o), baseName + 'Service.ts');
        }
    }
    else {
        return path_1.resolve(argv.o, baseName + 'Service.ts');
    }
};
try {
    let handledFiles = [];
    let primary = true;
    const recursiveGen = (input, basePath = null) => {
        let inputFile = resolveInput(input, basePath);
        if (!basePath) {
            basePath = path_1.dirname(inputFile);
        }
        if (!fs_1.existsSync(inputFile)) {
            throw new Error(`The specified file <${input}> is not exists`);
        }
        let outputFile = resolveOutput(input, primary);
        primary = false;
        if (handledFiles.indexOf(input) > -1) {
            return;
        }
        handledFiles.push(input);
        mkdirp(path_1.resolve(path_1.dirname(outputFile)));
        const ast = genAst_1.default(fs_1.readFileSync(inputFile).toString());
        const tsCode = genServiceClient_1.default(ast, argv.r);
        fs_1.writeFileSync(outputFile, tsCode);
        if (ast['include']) {
            let includes = Object.keys(ast['include']).map(key => ast['include'][key]['value']);
            includes.forEach(include => {
                recursiveGen(include, basePath);
            });
        }
    };
    recursiveGen(argv.i);
}
catch (err) {
    throw err;
}
