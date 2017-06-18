"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let genAST = require('./genAst');
let genTS = require('./genTS');
const path_1 = require("path");
const fs_1 = require("fs");
module.exports = (code, output, webAPIPath) => {
    let ts = genTS(genAST(code), webAPIPath);
    let file = path_1.default.resolve(output);
    fs_1.default.writeFileSync(file, ts);
};
