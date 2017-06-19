import genAST from './genAst';
import genTS from './genTS';

export default (code: string, webAPIPath: string) => {
    return genTS(genAST(code), webAPIPath);
}
