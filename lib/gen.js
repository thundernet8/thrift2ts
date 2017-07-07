"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const genAst_1 = require("./genAst");
const genTS_1 = require("./genTS");
const prettier_config_1 = require("./prettier-config");
const prettier = require("prettier");
exports.default = (code, Request) => {
    const ts = genTS_1.default(genAst_1.default(code), Request);
    return prettier.format(ts, prettier_config_1.default);
};
