let genAST = require('./genAst');
let genTS = require('./genTS');
module.exports = (code, webAPIPath) => {
    return genTS(genAST(code), webAPIPath);
};
