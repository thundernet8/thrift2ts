let genAST = require('./genAst');
let genTS = require('./genTS');

module.exports = (code: string, webAPIPath: string) => {
    return genTS(genAST(code), webAPIPath);
}
