"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_1 = require("./error");
let simplifyDataType = (type) => {
    switch (type.name.toLowerCase()) {
        case 'map':
        case 'list':
        case 'set':
            return type;
        default:
            return type.name.toString();
    }
};
exports.default = (code) => {
    code = code.toString();
    let nCount = 0;
    let rCount = 0;
    let offset = 0;
    let stack = [];
    let tailCommentQueue = [];
    let headCommentQueue = [];
    const backup = () => {
        stack.push({ offset, nCount, rCount });
    };
    const restore = () => {
        let saveCase = stack[stack.length - 1];
        offset = saveCase.offset;
        nCount = saveCase.nCount;
        rCount = saveCase.rCount;
    };
    const drop = () => {
        stack.pop();
    };
    const getLineNum = () => {
        return Math.max(rCount, nCount) + 1;
    };
    const throwError = (message) => {
        let line = getLineNum();
        message = `${message}\non Line ${line}`;
        let context = code.slice(offset, offset + 100);
        throw new error_1.ThriftSyntaxError(message, context, line);
    };
    const recordLineNum = (char) => {
        if (char === '\n') {
            nCount++;
        }
        else if (char === '\r') {
            rCount++;
        }
    };
    const readSingleLineComment = () => {
        let i = 0;
        if (['#', '/'].indexOf(code[offset + i++]) < 0 || code[offset + i++] !== '/') {
            return false;
        }
        let comment = '';
        while (code[offset] !== '\n' && code[offset] !== '\r') {
            comment += code[offset++];
        }
        return comment;
    };
    const readMultiLinesComment = () => {
        let i = 0;
        if (code[offset + i++] !== '/' || code[offset + i++] !== '*') {
            return false;
        }
        let comment = '/*';
        do {
            while (offset + i < code.length && code[offset + i] !== '*') {
                recordLineNum(code[offset + i]);
                comment += code[offset + i++];
            }
            comment += code[offset + i];
            i++;
        } while (offset + i < code.length && code[offset + i] !== '/');
        comment += '/';
        offset += ++i;
        return comment;
    };
    const readCurrentLineSpace = () => {
        while (offset < code.length) {
            let char = code[offset];
            recordLineNum(char);
            if (char === '\n' || char === '\r') {
                offset++;
                break;
            }
            if (char === ' ' || char === '\t') {
                offset++;
            }
            else {
                let comment1 = readMultiLinesComment();
                if (comment1) {
                    readCurrentLineSpace();
                }
                let comment2 = readSingleLineComment();
                if (!comment1 && !comment2) {
                    break;
                }
                (comment1 || comment2) && tailCommentQueue.push((comment1 || comment2));
            }
        }
        return;
    };
    const readNewLineSpace = () => {
        while (offset < code.length) {
            let char = code[offset];
            recordLineNum(char);
            if (char === '\n' || char === '\r' || char === ' ' || char === '\t') {
                offset++;
            }
            else {
                let comment = readMultiLinesComment() || readSingleLineComment();
                comment && headCommentQueue.push(comment);
                if (!comment) {
                    break;
                }
            }
        }
        return;
    };
    const readSpace = () => {
        readCurrentLineSpace();
        readNewLineSpace();
    };
    const readCommentFromQueue = (isTail = false) => {
        let queue = isTail ? tailCommentQueue : headCommentQueue;
        let comments = [];
        let comment;
        while (comment = queue.shift()) {
            if (comment.startsWith('#')) {
                comment = '//' + comment.slice(1);
            }
            comments.push(comment);
        }
        return comments.join('\r\n');
    };
    const readUntilThrow = (transaction, key) => {
        let container = key ? {} : [];
        while (true) {
            try {
                backup();
                let result = transaction();
                key ? container[result[key]] = result : container.push(result);
            }
            catch (exception) {
                restore();
                return container;
            }
            finally {
                drop();
            }
        }
    };
    const readKeyword = (word) => {
        for (let i = 0; i < word.length; i++) {
            if (code[offset + i] !== word[i]) {
                let token = code.substr(offset, word.length);
                throw new Error(`Unexpected token ${token} (current call: readKeyword)`);
            }
        }
        offset += word.length;
        readSpace();
        return word;
    };
    const readChar = (char) => {
        if (code[offset] !== char) {
            throw new Error(`Unexpected char ${code[offset]} (current call: readChar)`);
        }
        offset++;
        readSpace();
        return char;
    };
    const readComma = () => {
        let char = code[offset];
        if (/[,|;]/.test(char)) {
            offset++;
            readSpace();
            return char;
        }
    };
    const readSubject = () => {
        return readWith(readNamespace, readInclude, readTypedef, readConst, readEnum, readStruct, readUnion, readException, readService);
    };
    const readTypedef = () => {
        let subject = readKeyword('typedef');
        let type = readType();
        let name = readName();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, headComment, tailComment };
    };
    const readConst = () => {
        let subject = readKeyword('const');
        let type = readType();
        let name = readName();
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, value, headComment, tailComment };
    };
    const readEnum = () => {
        let subject = readKeyword('enum');
        let type = {
            name: 'enum'
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readEnumBlock();
        return { subject, type, name, items, headComment, tailComment };
    };
    const readEnumBlock = () => {
        readChar('{');
        let items = readUntilThrow(readEnumItem);
        readChar('}');
        return items;
    };
    const readEnumItem = () => {
        let name = readName();
        let type = 'enum';
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { name, type, value, headComment, tailComment };
    };
    const readStruct = () => {
        let subject = readKeyword('struct');
        let type = {
            name: 'struct'
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };
    const readStructLikeBlock = () => {
        readChar('{');
        let result = readUntilThrow(readStructLikeItem);
        readChar('}');
        return result;
    };
    const readStructLikeItem = () => {
        let id;
        try {
            id = readNumValue();
            readChar(':');
        }
        catch (exception) {
        }
        let option = readWith(readKeyword.bind(this, 'required'), readKeyword.bind(this, 'optional'), () => { });
        let type = simplifyDataType(readType());
        let name = readName();
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let result = { id, type, name, headComment, tailComment };
        if (option !== undefined) {
            result.option = option;
        }
        if (value !== undefined) {
            result.value = value;
        }
        return result;
    };
    const readUnion = () => {
        let subject = readKeyword('union');
        let type = {
            name: 'union'
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };
    const readException = () => {
        let subject = readKeyword('exception');
        let type = {
            name: 'exception'
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };
    const readExtends = () => {
        try {
            backup();
            readKeyword('extends');
            let name = readRefValue().join('.');
            return name;
        }
        catch (exception) {
            restore();
            return;
        }
        finally {
            drop();
        }
    };
    const readService = () => {
        let subject = readKeyword('service');
        let type = {
            name: 'service'
        };
        let name = readName();
        let extend = readExtends();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let functions = readServiceBlock();
        let result = { subject, type, name, headComment, tailComment };
        if (extend !== undefined) {
            result.extends = extend;
        }
        if (functions !== undefined) {
            result.functions = functions;
        }
        return result;
    };
    const readServiceBlock = () => {
        readChar('{');
        let result = readUntilThrow(readServiceItem, 'name');
        readChar('}');
        return result;
    };
    const readServiceItem = () => {
        let oneway = !!readWith(readOneway, () => { });
        let type = simplifyDataType(readType());
        let name = readName();
        let headComment = readCommentFromQueue();
        let args = readServiceArgs();
        let tailComment = readCommentFromQueue(true);
        let throws = readServiceThrow();
        readComma();
        return { type, name, args, throws, oneway, headComment, tailComment };
    };
    const readServiceArgs = () => {
        readChar('(');
        let result = readUntilThrow(readStructLikeItem);
        readChar(')');
        readSpace();
        return result;
    };
    const readServiceThrow = () => {
        try {
            backup();
            readKeyword('throws');
            return readServiceArgs();
        }
        catch (exception) {
            restore();
            return [];
        }
        finally {
            drop();
        }
    };
    const readNamespace = () => {
        let subject = readKeyword('namespace');
        let type = {
            name: 'namespace'
        };
        let name;
        let i = 0;
        let char = code[offset];
        while (/[a-zA-Z0-9_\*]/.test(char)) {
            if (offset + ++i >= code.length) {
                throw new Error('Unexpected end (current call: readNamespace)');
            }
            char = code[offset + i];
        }
        if (i === 0) {
            throw new Error('Unexpected token  (current call: readNamespace)');
        }
        name = code.slice(offset, offset += i);
        readSpace();
        let serviceName = readRefValue().join('.');
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, value: serviceName, headComment, tailComment };
    };
    const readInclude = () => {
        let subject = readKeyword('include');
        let type = {
            name: 'include'
        };
        readSpace();
        let includePath = readQuotation();
        let name = includePath.replace(/^.*?([^/\\]*?)(?:\.thrift)?$/, '$1');
        readSpace();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, value: includePath, headComment, tailComment };
    };
    const readQuotation = () => {
        if (code[offset] === '"' || code[offset] === '\'') {
            offset++;
        }
        else {
            throw new Error('Unexpected token (current call: readQuotation)');
        }
        let end = offset;
        while (code[end] !== '"' && code[end] !== '\'' && end < code.length) {
            end++;
        }
        if (code[end] === '"' || code[end] === '\'') {
            let quote = code.slice(offset, end);
            offset = end + 1;
            return quote;
        }
        else {
            throw new Error('Unexpected token (current call: readQuotation)');
        }
    };
    const readOneway = () => {
        return readKeyword('oneway');
    };
    const readType = () => {
        return readWith(readMapType, readSetOrListType, readNormalType);
    };
    const readMapType = () => {
        let name = readName();
        readChar('<');
        let keyType = simplifyDataType(readType());
        readComma();
        let valueType = simplifyDataType(readType());
        readChar('>');
        return { name, keyType, valueType };
    };
    const readSetOrListType = () => {
        let name = readName();
        readChar('<');
        let valueType = simplifyDataType(readType());
        readChar('>');
        return { name, valueType };
    };
    const readNormalType = () => {
        let name = readName();
        return { name };
    };
    const readValue = () => {
        return readWith(readHexadecimalValue, readEnotationValue, readNumValue, readBoolValue, readStringValue, readListOrSetValue, readMapValue, readRefValue);
    };
    const readNumValue = () => {
        let value = [];
        if (code[offset] === '-') {
            value.push('-');
            offset++;
        }
        while (true) {
            let char = code[offset];
            if (/[0-9\.]/.test(char)) {
                offset++;
                value.push(char);
            }
            else if (value.length) {
                readSpace();
                return +value.join('');
            }
            else {
                throw new Error(`Unexpected token ${char} (current call: readNumValue)`);
            }
        }
    };
    const readBoolValue = () => {
        return JSON.parse(readWith(readKeyword.bind(this, 'true'), readKeyword.bind(this, 'false')));
    };
    const readStringValue = () => {
        let value = [];
        let quote;
        while (true) {
            let char = code[offset++];
            if (!value.length) {
                if (char !== '\'' && char !== '"') {
                    throw new Error('Unexpected token (current call: readStringValue)');
                }
                else {
                    quote = char;
                    value.push(char);
                }
            }
            else {
                if (char === '\\') {
                    value.push(char);
                    value.push(code[offset++]);
                }
                else if (char === quote) {
                    value.push(char);
                    readSpace();
                    return new Function('return ' + value.join(''))();
                }
                else {
                    value.push(char);
                }
            }
        }
    };
    const readListOrSetValue = () => {
        readChar('[');
        let list = readUntilThrow(() => {
            let value = readValue();
            readComma();
            return value;
        });
        readChar(']');
        return list;
    };
    const readMapValue = () => {
        readChar('{');
        let map = readUntilThrow(() => {
            let key = readValue();
            readChar(':');
            let value = readValue();
            readComma();
            return { key, value };
        });
        readChar('}');
        return map;
    };
    const readRefValue = () => {
        let list = [readName()];
        let others = readUntilThrow(() => {
            readChar('.');
            return readName();
        });
        return list.concat(others);
    };
    const readEnotationValue = () => {
        let value = [];
        if (code[offset] === '-') {
            value.push('-');
            offset++;
        }
        while (true) {
            let char = code[offset];
            if (/[0-9\.]/.test(char)) {
                value.push(char);
                offset++;
            }
            else {
                break;
            }
        }
        if (code[offset] !== 'e' && code[offset] !== 'E') {
            throw new Error('Unexpected token (current call: readEnotationValue)');
        }
        value.push(code[offset++]);
        while (true && offset < code.length) {
            let char = code[offset];
            if (/[0-9]/.test(char)) {
                offset++;
                value.push(char);
            }
            else {
                if (value.length) {
                    readSpace();
                    return +value.join('');
                }
                else {
                    throw new Error(`Unexpect token ${char} (current call: readEnotationValue)`);
                }
            }
        }
    };
    const readHexadecimalValue = () => {
        let value = [];
        if (code[offset] === '-') {
            value.push(code[offset++]);
        }
        if (code[offset] !== '0') {
            throw new Error(`Unexpected token ${code[offset]} (current call: readHexadecimalValue)`);
        }
        value.push(code[offset++]);
        while (true) {
            let char = code[offset];
            if (/[0-9a-zA-Z]/.test(char)) {
                offset++;
                value.push(char);
            }
            else {
                if (value.length) {
                    readSpace();
                    return +value.join('');
                }
                else {
                    throw new Error(`Unexpected token ${char} (current call: readHexadecimalValue)`);
                }
            }
        }
    };
    const readName = () => {
        let i = 0;
        let char = code[offset];
        while (/[a-zA-Z0-9_\.]/.test(char)) {
            char = code[offset + ++i];
        }
        if (i === 0) {
            throw new Error('Invalid name string (current call: readName)');
        }
        let value = code.slice(offset, offset += i);
        readSpace();
        return value;
    };
    const readAssign = () => {
        try {
            backup();
            readChar('=');
            return readValue();
        }
        catch (exception) {
            restore();
        }
        finally {
            drop();
        }
    };
    const readWith = (...readers) => {
        backup();
        for (let i = 0; i < readers.length; i++) {
            try {
                let result = readers[i]();
                drop();
                return result;
            }
            catch (exception) {
                restore();
                continue;
            }
        }
        drop();
        throw new Error('Unexcepted Token (current call: readWith)');
    };
    const parseThrift = () => {
        readSpace();
        let ast = {};
        while (true) {
            try {
                let block = readSubject();
                let { subject, name } = block;
                if (!ast[subject]) {
                    ast[subject] = {};
                }
                delete block.subject;
                delete block.name;
                switch (subject) {
                    case 'exception':
                    case 'struct':
                    case 'union':
                        ast[subject][name] = block['items'];
                        break;
                    default:
                        ast[subject][name] = block;
                }
            }
            catch (exception) {
                throwError(exception);
            }
            finally {
                if (code.length === offset)
                    break;
            }
        }
        return ast;
    };
    return parseThrift();
};
