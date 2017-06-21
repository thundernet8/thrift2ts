"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const genAst_1 = require("./genAst");
const genTS_1 = require("./genTS");
exports.default = (code, Request) => {
    return genTS_1.default(genAst_1.default(code), Request);
};
