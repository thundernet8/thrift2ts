import genAST from "./genAst";
import genTS from "./genTS";
import prettierConfig from "./prettier-config";
const prettier = require("prettier");

export default (code: string, Request: string) => {
    const ts = genTS(genAST(code), Request);
    return prettier.format(ts, prettierConfig);
};
