let genAST = require('./genAst');
let genTS = require('./genTS');
import path from 'path';
import fs from 'fs';

module.exports = (code: string, output: string, webAPIPath: string) => {
    let ts = genTS(genAST(code), webAPIPath);
    let file = path.resolve(output);
    fs.writeFileSync(file, ts);
}
