/// <reference="../node_modules/@types/node/index.d.ts" />

import { ThriftSyntaxError } from "./error";

// Thrift keywords
// 1. Basis
// bool
// byte
// i16
// i32
// i64
// double
// string
// 2. Specials
// binary
// 3. Struct
// struct
// 4. Containers
// list
// set
// map
// 5. Enum
// enum
// 6. Constant & Type Definition
// const
// typedef
// 7. Exception
// exception
// 8. Service
// service
// oneway
// 9. Namespace
// namespace
// 10. Include
// include
// 11. Others
// void
// required
// optional
// union
// extends

// Valid chars
// a-z A-Z 0-9 _ : , ; ' " { } [ ] ( )

// Interfaces
interface ISubjectBlock {
    subject: string;
    type: IDataType;
    name: string;
    value?: any;
    headComment?: string;
    tailComment?: string;
}

// Enum/Struct/Union/Exception
interface IListSubjectBlock extends ISubjectBlock {
    items: IListSubjectItem[];
}

interface IListSubjectItem {
    id?: number;
    name: string;
    type: string | IDataType;
    value?: any;
    option?: string;
    headComment?: string;
    tailComment?: string;
}

// Service
interface IServiceSubjectBlock extends ISubjectBlock {
    functions?: IServiceSubjectFunction[];
    extends?: string;
}

interface IServiceSubjectFunction {
    type: string | IDataType;
    name: string;
    args: IServiceSubjectFunctionArg[];
    throws: any[];
    oneway: boolean;
    headComment?: string;
    tailComment?: string;
}

interface IServiceSubjectFunctionArg {
    index: number;
    type: string | IDataType;
    name: string;
}

// Types
// e.g map<t1, t2> list<t> set<t> i32 string..
interface IDataType {
    name: string;
    keyType?: string; // for map
    valueType?: string; // for map set list
}

let simplifyDataType = (type: IDataType): string | IDataType => {
    switch (type.name.toLowerCase()) {
        case "map":
        //return `map<${type.keyType}, ${type.valueType}>`;
        case "list":
        //return `list<${type.valueType}>`;
        case "set":
            //return `set<${type.valueType}>`;
            return type;
        default:
            return type.name.toString();
    }
};

export default (code: string): object => {
    code = code.toString();

    let nCount = 0; // count of \n
    let rCount = 0; // count of \r
    let offset = 0;
    let stack: { offset: number; nCount: number; rCount: number }[] = [];
    let tailCommentQueue: string[] = [];
    let headCommentQueue: string[] = [];

    const backup = (): void => {
        stack.push({ offset, nCount, rCount });
    };

    const restore = (): void => {
        let saveCase = stack[stack.length - 1];
        offset = saveCase.offset;
        nCount = saveCase.nCount;
        rCount = saveCase.rCount;
    };

    const drop = (): void => {
        stack.pop();
    };

    const getLineNum = (): number => {
        return Math.max(rCount, nCount) + 1;
    };

    const throwError = (message: string): void => {
        let line = getLineNum();
        message = `${message}\non Line ${line}`;
        let context = code.slice(offset, offset + 100);
        throw new ThriftSyntaxError(message, context, line);
    };

    // record line
    // note \r \n \r\n
    // line = Max(rCount, nCount) + 1
    const recordLineNum = (char: string): void => {
        if (char === "\n") {
            nCount++;
        } else if (char === "\r") {
            rCount++;
        }
    };

    // parse single line comment, start with # or //, stop utill line end
    const readSingleLineComment = (): boolean | string => {
        let i = 0;
        if (
            ["#", "/"].indexOf(code[offset + i++]) < 0 ||
            code[offset + i++] !== "/"
        ) {
            return false;
        }

        let comment = "";
        while (code[offset] !== "\n" && code[offset] !== "\r") {
            comment += code[offset++];
        }
        return comment;
    };

    // parse multiple lines comment, start with /*, end with */
    const readMultiLinesComment = (): boolean | string => {
        let i = 0;
        if (code[offset + i++] !== "/" || code[offset + i++] !== "*") {
            return false;
        }

        let comment = "/*";
        do {
            while (offset + i < code.length && code[offset + i] !== "*") {
                recordLineNum(code[offset + i]);
                comment += code[offset + i++];
            }
            comment += code[offset + i];
            i++;
        } while (offset + i < code.length && code[offset + i] !== "/");

        comment += "/";
        offset += ++i;
        return comment;
    };

    // read space to the end of current line or end of a `/* xx */` comment
    // to find a tail comment
    const readCurrentLineSpace = (): void => {
        while (offset < code.length) {
            let char = code[offset];
            recordLineNum(char);
            if (char === "\n" || char === "\r") {
                offset++;
                break;
            }
            if (char === " " || char === "\t") {
                offset++;
            } else {
                // sometimes multiple comment was used as single line comment
                // e.g `/*comment1*/ //comment2`
                let comment1 = readMultiLinesComment();
                if (comment1) {
                    readCurrentLineSpace();
                }
                let comment2 = readSingleLineComment();
                if (!comment1 && !comment2) {
                    break;
                }
                (comment1 || comment2) &&
                    tailCommentQueue.push(<string>(comment1 || comment2));
            }
        }
        return;
    };

    // read space from new line
    // to find head comments
    // this method should be used after `readCurrentLineSpace`
    const readNewLineSpace = (): void => {
        while (offset < code.length) {
            let char = code[offset];
            recordLineNum(char);
            if (
                char === "\n" ||
                char === "\r" ||
                char === " " ||
                char === "\t"
            ) {
                offset++;
            } else {
                let comment =
                    readMultiLinesComment() || readSingleLineComment();
                comment && headCommentQueue.push(<string>comment);
                if (!comment) {
                    break;
                }
            }
        }
        return;
    };

    const readSpace = (): void => {
        readCurrentLineSpace();
        readNewLineSpace();
    };

    const readCommentFromQueue = (isTail = false): string => {
        let queue = isTail ? tailCommentQueue : headCommentQueue;
        let comments = [];
        let comment: string;
        while ((comment = queue.shift())) {
            if (comment.startsWith("#")) {
                comment = "//" + comment.slice(1);
            }
            comments.push(comment);
        }
        return comments.join("\r\n");
    };

    const readUntilThrow = (transaction: () => void, key?: string): any => {
        let container: any = key ? {} : [];
        while (true) {
            try {
                backup();
                let result = transaction();
                key
                    ? (container[result[key]] = result)
                    : container.push(result);
            } catch (exception) {
                restore();
                return container;
            } finally {
                drop();
            }
        }
    };

    const readKeyword = (word: string): string => {
        for (let i = 0; i < word.length; i++) {
            if (code[offset + i] !== word[i]) {
                let token = code.substr(offset, word.length);
                throw new Error(
                    `Unexpected token ${token} (current call: readKeyword)`
                );
            }
        }
        offset += word.length;
        readSpace();
        return word;
    };

    const readChar = (char: string): string => {
        if (code[offset] !== char) {
            throw new Error(
                `Unexpected char ${code[offset]} (current call: readChar)`
            );
        }
        offset++;
        readSpace();
        return char;
    };

    const readComma = (): string => {
        let char = code[offset];
        if (/[,|;]/.test(char)) {
            offset++;
            readSpace();
            return char;
        }
    };

    // read a subject block, e.g struct {}
    const readSubject = (): ISubjectBlock => {
        return readWith(
            readNamespace,
            readInclude,
            readTypedef,
            readConst,
            readEnum,
            readStruct,
            readUnion,
            readException,
            readService
        );
    };

    // subject readers
    // typedef/const/enum/struct/union/exception/service/namespace/include

    const readTypedef = (): ISubjectBlock => {
        let subject = readKeyword("typedef");
        let type = readType();
        let name = readName();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, headComment, tailComment };
    };

    const readConst = (): ISubjectBlock => {
        let subject = readKeyword("const");
        let type = readType();
        let name = readName();
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { subject, type, name, value, headComment, tailComment };
    };

    const readEnum = (): IListSubjectBlock => {
        let subject = readKeyword("enum");
        let type = {
            name: "enum"
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readEnumBlock();
        return { subject, type, name, items, headComment, tailComment };
    };

    const readEnumBlock = (): IListSubjectItem[] => {
        readChar("{");
        let items = readUntilThrow(readEnumItem);
        readChar("}");
        return items;
    };

    const readEnumItem = (): IListSubjectItem => {
        let name = readName();
        let type = "enum";
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return { name, type, value, headComment, tailComment };
    };

    const readStruct = (): IListSubjectBlock => {
        let subject = readKeyword("struct");
        let type = {
            name: "struct"
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };

    const readStructLikeBlock = (): IListSubjectItem[] => {
        readChar("{");
        let result = readUntilThrow(readStructLikeItem);
        readChar("}");
        return result;
    };

    const readStructLikeItem = (): IListSubjectItem => {
        let id;
        // struct MyStruct {
        //     1: required int id,
        //     2: required bool name
        // }
        try {
            id = readNumValue();
            readChar(":");
        } catch (exception) {}

        let option = readWith(
            readKeyword.bind(this, "required"),
            readKeyword.bind(this, "optional"),
            () => {}
        );
        let type = simplifyDataType(readType());
        let name = readName();
        let value = readAssign();
        readComma();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let result: IListSubjectItem = {
            id,
            type,
            name,
            headComment,
            tailComment
        };
        if (option !== undefined) {
            result.option = option;
        }
        if (value !== undefined) {
            result.value = value;
        }
        return result;
    };

    const readUnion = (): IListSubjectBlock => {
        let subject = readKeyword("union");
        let type = {
            name: "union"
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };

    const readException = (): IListSubjectBlock => {
        let subject = readKeyword("exception");
        let type = {
            name: "exception"
        };
        let name = readName();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let items = readStructLikeBlock();
        return { subject, type, name, items, headComment, tailComment };
    };

    const readExtends = (): string => {
        try {
            backup();
            readKeyword("extends");
            let name = readRefValue().join(".");
            return name;
        } catch (exception) {
            restore();
            return;
        } finally {
            drop();
        }
    };

    const readService = (): IServiceSubjectBlock => {
        let subject = readKeyword("service");
        let type = {
            name: "service"
        };
        let name = readName();
        let extend = readExtends();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        let functions = readServiceBlock();
        let result: IServiceSubjectBlock = {
            subject,
            type,
            name,
            headComment,
            tailComment
        };
        if (extend !== undefined) {
            result.extends = extend;
        }
        if (functions !== undefined) {
            result.functions = functions;
        }
        return result;
    };

    const readServiceBlock = (): IServiceSubjectFunction[] => {
        readChar("{");
        let result = readUntilThrow(readServiceItem, "name");
        readChar("}");
        return result;
    };

    const readServiceItem = (): IServiceSubjectFunction => {
        let oneway = !!readWith(readOneway, () => {});
        let type = simplifyDataType(readType()); // function return type
        let name = readName();
        let headComment = readCommentFromQueue();
        let args = readServiceArgs();
        let tailComment = readCommentFromQueue(true);
        let throws = readServiceThrow();
        readComma();
        return { type, name, args, throws, oneway, headComment, tailComment };
    };

    const readServiceArgs = (): any[] => {
        readChar("(");
        let result = readUntilThrow(readStructLikeItem);
        readChar(")");
        readSpace();
        return result;
    };

    const readServiceThrow = (): any[] => {
        try {
            backup();
            readKeyword("throws");
            return readServiceArgs();
        } catch (exception) {
            restore();
            return [];
        } finally {
            drop();
        }
    };

    const readNamespace = (): ISubjectBlock => {
        // e.g -> namespace java com.company.service
        let subject = readKeyword("namespace");
        let type = {
            name: "namespace"
        };
        let name;
        // now read the `java` in sample
        let i = 0;
        let char = code[offset];
        while (/[a-zA-Z0-9_\*]/.test(char)) {
            if (offset + ++i >= code.length) {
                throw new Error("Unexpected end (current call: readNamespace)");
            }
            char = code[offset + i];
        }
        if (i === 0) {
            throw new Error("Unexpected token  (current call: readNamespace)");
        }
        name = code.slice(offset, (offset += i));
        readSpace();
        // read `com.company.service` in sample
        let serviceName = readRefValue().join(".");
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return {
            subject,
            type,
            name,
            value: serviceName,
            headComment,
            tailComment
        };
    };

    const readInclude = (): ISubjectBlock => {
        let subject = readKeyword("include");
        let type = {
            name: "include"
        };
        readSpace();
        let includePath = readQuotation();
        let name = includePath.replace(/^.*?([^/\\]*?)(?:\.thrift)?$/, "$1");
        readSpace();
        let headComment = readCommentFromQueue();
        let tailComment = readCommentFromQueue(true);
        return {
            subject,
            type,
            name,
            value: includePath,
            headComment,
            tailComment
        };
    };

    const readQuotation = (): string => {
        if (code[offset] === '"' || code[offset] === "'") {
            offset++;
        } else {
            throw new Error("Unexpected token (current call: readQuotation)");
        }

        let end = offset;
        while (code[end] !== '"' && code[end] !== "'" && end < code.length) {
            end++;
        }
        if (code[end] === '"' || code[end] === "'") {
            let quote = code.slice(offset, end);
            offset = end + 1;
            return quote;
        } else {
            throw new Error("Unexpected token (current call: readQuotation)");
        }
    };

    const readOneway = (): string => {
        return readKeyword("oneway");
    };

    // subject item readers
    // e.g Enum item, Struct item

    const readType = (): IDataType => {
        return readWith(readMapType, readSetOrListType, readNormalType);
    };

    const readMapType = (): IDataType => {
        let name = readName(); // map
        readChar("<");
        let keyType = simplifyDataType(readType()) as string;
        readComma();
        let valueType = simplifyDataType(readType()) as string;
        readChar(">");
        return { name, keyType, valueType };
    };

    const readSetOrListType = (): IDataType => {
        let name = readName(); // list/set
        readChar("<");
        let valueType = simplifyDataType(readType()) as string;
        readChar(">");
        return { name, valueType };
    };

    const readNormalType = (): IDataType => {
        let name = readName();
        return { name };
    };

    const readValue = (): any => {
        return readWith(
            readHexadecimalValue,
            readEnotationValue,
            readNumValue,
            readBoolValue,
            readStringValue,
            readListOrSetValue,
            readMapValue,
            readRefValue
        );
    };

    const readNumValue = (): number => {
        let value = [];
        if (code[offset] === "-") {
            value.push("-");
            offset++;
        }

        while (true) {
            let char = code[offset];
            if (/[0-9\.]/.test(char)) {
                offset++;
                value.push(char);
            } else if (value.length) {
                readSpace();
                return +value.join("");
            } else {
                throw new Error(
                    `Unexpected token ${char} (current call: readNumValue)`
                );
            }
        }
    };

    const readBoolValue = (): boolean => {
        return JSON.parse(
            readWith(
                readKeyword.bind(this, "true"),
                readKeyword.bind(this, "false")
            )
        );
    };

    const readStringValue = (): string => {
        let value = [];
        let quote;
        while (true) {
            let char = code[offset++];
            if (!value.length) {
                if (char !== "'" && char !== '"') {
                    throw new Error(
                        "Unexpected token (current call: readStringValue)"
                    );
                } else {
                    quote = char;
                    value.push(char);
                }
            } else {
                if (char === "\\") {
                    value.push(char);
                    value.push(code[offset++]);
                } else if (char === quote) {
                    value.push(char);
                    readSpace();
                    return new Function("return " + value.join(""))();
                } else {
                    value.push(char);
                }
            }
        }
    };

    const readListOrSetValue = (): any[] => {
        readChar("[");
        let list = readUntilThrow((): any => {
            let value = readValue();
            readComma();
            return value;
        });
        readChar("]");
        return list;
    };

    const readMapValue = (): object => {
        readChar("{");
        let map = readUntilThrow((): { key: string; value: any } => {
            let key = readValue();
            readChar(":");
            let value = readValue();
            readComma();
            return { key, value };
        });
        readChar("}");
        return map;
    };

    // e.g read `com.company.service` in `namespace go com.company.service`
    const readRefValue = (): string[] => {
        let list = [readName()];
        let others = readUntilThrow((): string => {
            readChar(".");
            return readName();
        });
        return list.concat(others);
    };

    // e.g read -1.0e6 2.1e-1
    const readEnotationValue = (): number => {
        let value = [];
        if (code[offset] === "-") {
            value.push("-");
            offset++;
        }

        while (true) {
            let char = code[offset];
            if (/[0-9\.]/.test(char)) {
                value.push(char);
                offset++;
            } else {
                break;
            }
        }

        if (code[offset] !== "e" && code[offset] !== "E") {
            throw new Error(
                "Unexpected token (current call: readEnotationValue)"
            );
        }
        value.push(code[offset++]);

        while (true && offset < code.length) {
            let char = code[offset];
            if (/[0-9]/.test(char)) {
                offset++;
                value.push(char);
            } else {
                if (value.length) {
                    readSpace();
                    return +value.join("");
                } else {
                    throw new Error(
                        `Unexpect token ${char} (current call: readEnotationValue)`
                    );
                }
            }
        }
    };

    // e.g 0x0000ff
    const readHexadecimalValue = (): number => {
        let value = [];
        if (code[offset] === "-") {
            value.push(code[offset++]);
        }

        if (code[offset] !== "0") {
            throw new Error(
                `Unexpected token ${code[
                    offset
                ]} (current call: readHexadecimalValue)`
            );
        }
        value.push(code[offset++]);

        while (true) {
            let char = code[offset];
            if (/[0-9a-zA-Z]/.test(char)) {
                offset++;
                value.push(char);
            } else {
                if (value.length) {
                    readSpace();
                    return +value.join("");
                } else {
                    throw new Error(
                        `Unexpected token ${char} (current call: readHexadecimalValue)`
                    );
                }
            }
        }
    };

    const readName = (): string => {
        let i = 0;
        let char = code[offset];
        while (/[a-zA-Z0-9_\.]/.test(char)) {
            char = code[offset + ++i];
        }

        if (i === 0) {
            throw new Error("Invalid name string (current call: readName)");
        }

        let value = code.slice(offset, (offset += i));
        readSpace();
        return value;
    };

    const readAssign = (): any => {
        try {
            backup();
            readChar("=");
            return readValue();
        } catch (exception) {
            restore();
        } finally {
            drop();
        }
    };

    // read specified content in the code
    const readWith = (...readers): any => {
        backup();
        for (let i = 0; i < readers.length; i++) {
            try {
                let result = readers[i]();
                drop();
                return result;
            } catch (exception) {
                restore();
                continue;
            }
        }
        drop();
        throw new Error("Unexcepted Token (current call: readWith)");
    };

    // main function
    const parseThrift = (): object => {
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
                    case "exception":
                    case "struct":
                    case "union":
                        ast[subject][name] = block["items"];
                        break;
                    default:
                        ast[subject][name] = block;
                }
            } catch (exception) {
                throwError(exception);
            } finally {
                if (code.length === offset) break;
            }
        }
        return ast;
    };

    return parseThrift();
};
