import genAST from './genAst';
import genTS from './genTS';

export default (code: string, Request: string) => {
    return genTS(genAST(code), Request);
}
