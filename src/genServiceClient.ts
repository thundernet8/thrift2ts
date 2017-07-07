import { thrift2TsPath, getThriftFileName } from "./helpers";
import prettierConfig from "./prettier-config";
const prettier = require("prettier");

const thriftTypeMapper = {
    byte: "ThriftType.BYTE",
    i16: "ThriftType.I16",
    i32: "ThriftType.I32",
    i64: "ThriftType.I64",
    double: "ThriftType.DOUBLE",
    string: "ThriftType.STRING",
    list: "ThriftType.LIST",
    set: "ThriftType.SET",
    map: "ThriftType.MAP",
    struct: "ThriftType.STRUCT",
    bool: "ThriftType.BOOL",
    void: "ThriftType.VOID",
    stop: "ThriftType.STOP"
};

const fieldReaderMapper = {
    byte: "readByte()",
    i16: "readI16()",
    i32: "readI32()",
    i64: "readI64()",
    double: "readDouble()",
    string: "readString()",
    bool: "readBool()"
};

const fieldWriterMapper = {
    byte: "writeByte",
    i16: "writeI16",
    i32: "writeI32",
    i64: "writeI64",
    double: "writeDouble",
    string: "writeString",
    bool: "writeBool"
};

const NEW_LINE = "\r\n";
const NEW_LINE_2 = "\r\n\r\n";

let header = `/**${NEW_LINE} * This service client is auto-generated by Thrift2Ts.${NEW_LINE} *${NEW_LINE} * ${new Date().toString()}${NEW_LINE} */${NEW_LINE_2}`;

// import TException from browser-thrift package
header += `import Thrift from "browser-thrift2"${NEW_LINE}`;
header += `import IProtocol, { ProtocolClass } from "browser-thrift2/src/thrift/interface/IProtocol"${NEW_LINE}`;
header += `import ITransport, { TransportClass } from "browser-thrift2/src/thrift/interface/ITransport"${NEW_LINE_2}`;
header += `const {${NEW_LINE}ThriftType,${NEW_LINE}MessageType,${NEW_LINE}TApplicationException,${NEW_LINE}TException${NEW_LINE}} = Thrift${NEW_LINE_2}`;

export default (ast: any): string => {
    let code = "";

    code += header;

    const defaultExports = [];

    const simplifyType = (type): string | object => {
        if (typeof type === "string") {
            return type;
        }

        switch (type.name.toLowerCase()) {
            case "map":
            case "list":
            case "set":
                return type;
            default:
                return type.name.toString();
        }
    };

    const mapThriftType = type => {
        if (typeof type === "object") {
            return type.name;
        }

        if (Object.keys(thriftTypeMapper).indexOf(type) > -1) {
            return type;
        }

        // maybe a custom typedef
        if (ast["typedef"] && Object.keys(ast["typedef"]).indexOf(type) > -1) {
            return ast["typedef"][type]["type"]["name"];
        }

        // maybe a custom enum
        if (ast["enum"] && Object.keys(ast["enum"]).indexOf(type) > -1) {
            return "i32";
        }

        // maybe a custom map
        if (ast["map"] && Object.keys(ast["map"]).indexOf(type) > -1) {
            return "map";
        }

        // maybe a custom list
        if (ast["list"] && Object.keys(ast["list"]).indexOf(type) > -1) {
            return "list";
        }

        // maybe a custom set
        if (ast["set"] && Object.keys(ast["set"]).indexOf(type) > -1) {
            return "set";
        }

        // maybe a custom struct
        if (ast["struct"] && Object.keys(ast["struct"]).indexOf(type) > -1) {
            return "struct";
        }

        // maybe a custom exception, recognize as struct
        if (
            ast["exception"] &&
            Object.keys(ast["exception"]).indexOf(type) > -1
        ) {
            return "struct";
        }

        throw new Error(`Unknown thrift type: ${type}`);
    };

    const getThriftTypeStr = type => {
        return thriftTypeMapper[mapThriftType(type)];
    };

    const getReaderStr = type => {
        return fieldReaderMapper[mapThriftType(type)];
    };

    const getWriterStr = type => {
        return fieldWriterMapper[mapThriftType(type)];
    };

    const valueTypeTransformer = (type): string => {
        type = simplifyType(type);

        if (typeof type === "string") {
            switch (type) {
                case "i16":
                case "i32":
                case "i64":
                case "double":
                    return "number";
                case "bool":
                    return "boolean";
                default:
                    return type;
            }
        }

        switch (type["name"]) {
            case "map":
                return `{[key: ${type["keyType"]}]: ${valueTypeTransformer(
                    type["valueType"]
                )}}`;
            case "list":
            case "set":
                return `${valueTypeTransformer(type["valueType"])}[]`;
        }
        throw new Error(`Unexpected value type: ${JSON.stringify(type)}`);
    };

    const valueTransformer = (value, isMap = false): string => {
        if (typeof value === "string") {
            return `\"${value}\"`;
        }
        if (["number", "boolean"].indexOf(typeof value) > -1) {
            return value.toString();
        }
        if (value instanceof Array) {
            if (isMap) {
                return `{${value.map(v => valueTransformer(v)).join(", ")}}`;
            }
            return `[${value.map(v => valueTransformer(v)).join(", ")}]`;
        }
        if (
            typeof value === "object" &&
            value["key"] !== undefined &&
            value["value"] !== undefined
        ) {
            return `"${value["key"]}": ${valueTransformer(value["value"])}`;
        }
        throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
    };

    const includesHandler = (includes: object[]): string => {
        let imports = [];
        Object.keys(includes).map(key => includes[key]).forEach(include => {
            imports.push(
                `${NEW_LINE}import * as ${getThriftFileName(
                    include.value
                )} from "${thrift2TsPath(
                    include.value,
                    false,
                    false
                )}";${NEW_LINE}`
            );
        });
        return imports.join("");
    };

    const constsHandler = (consts: object[]): string => {
        let newConsts = [];
        Object.keys(consts).forEach(key => {
            newConsts.push(
                `${NEW_LINE}export const ${key}: ${valueTypeTransformer(
                    consts[key]["type"]
                )} = ${valueTransformer(
                    consts[key]["value"],
                    typeof consts[key]["type"] === "object" &&
                        consts[key]["type"]["name"] === "map"
                )}; ${NEW_LINE}`
            );
        });
        return newConsts.join("");
    };

    const enumsHandler = (enums: object[]): string => {
        let newEnums = [];
        Object.keys(enums).forEach(key => {
            newEnums.push(enumHandler(key, enums[key]["items"]));
        });
        return newEnums.join("");
    };

    const enumHandler = (name, items: object[]): string => {
        let lastValue = -1;
        let codes = [`${NEW_LINE}export enum ${name} {`];
        items.forEach((item, index) => {
            if (item["value"] === undefined) {
                item["value"] = lastValue + 1;
            }
            lastValue = item["value"];
            codes.push(`${NEW_LINE}${item["name"]} = ${item["value"]}`);
            if (index < items.length - 1) {
                codes.push(",");
            }
        });
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    // Exceptions
    const exceptionsHandler = (values: object[]): string => {
        let exceptions = [];
        Object.keys(values).forEach(key => {
            exceptions.push(exceptionHandler(key, values[key]));
        });
        return exceptions.join("");
    };

    const exceptionHandler = (name, items: object[]): string => {
        let codes = [];
        codes.push(`${NEW_LINE}export class ${name} extends TException {`);
        items.forEach((item, index) => {
            codes.push(`${NEW_LINE}${item["name"]}`);
            if (item["option"] === "optional") {
                codes.push("?");
            }
            codes.push(`: ${valueTypeTransformer(item["type"])};`);
        });
        codes.push(`${NEW_LINE}name: string;`);

        // add constructor
        codes.push(`${NEW_LINE}${NEW_LINE}constructor (args?) {`);
        codes.push(`${NEW_LINE}super()`);
        codes.push(`${NEW_LINE}this.name = "${name}"`);
        items.forEach((item, index) => {
            let value = item["value"];
            if (value !== undefined) {
                if (item["type"] === "string") {
                    value = `"${value}"`;
                }
                codes.push(`${NEW_LINE}this.${item["name"]} = ${value}`);
            } else {
                codes.push(`${NEW_LINE}this.${item["name"]} = null`);
            }
        });
        codes.push(`${NEW_LINE}if (args) {`);
        items.forEach((item, index) => {
            let paramName = item["name"];
            codes.push(
                `${NEW_LINE}if (args.${paramName} !== undefined && args.${paramName} !== null) {${NEW_LINE}this.${paramName} = args.${paramName}${NEW_LINE}}`
            );
        });
        codes.push(`${NEW_LINE}}`);
        // close constructor
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        // add read function
        codes.push(
            `${NEW_LINE}read = (input: IProtocol) => {${NEW_LINE}input.readStructBegin()${NEW_LINE}while (true) {${NEW_LINE}let ret = input.readFieldBegin()${NEW_LINE}let fname = ret.fname${NEW_LINE}let ftype = ret.ftype${NEW_LINE}let fid = ret.fid${NEW_LINE}if (ftype === ThriftType.STOP) {${NEW_LINE}break${NEW_LINE}}${NEW_LINE}switch (fid) {`
        );
        items.forEach((item, index) => {
            let type = item["type"];
            codes.push(
                `${NEW_LINE}case ${index +
                    1}:${NEW_LINE}if (ftype === ${getThriftTypeStr(
                    type
                )}) {${NEW_LINE}this.${item["name"]} = input.${getReaderStr(
                    type
                )}${NEW_LINE}} else {${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}break`
            );
        });
        codes.push(
            `${NEW_LINE}default:${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}input.readFieldEnd()${NEW_LINE}}${NEW_LINE}input.readStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // add write function
        codes.push(
            `${NEW_LINE}${NEW_LINE}write = (output: IProtocol) => {${NEW_LINE}output.writeStructBegin('${name}')`
        );
        items.forEach((item, index) => {
            let type = item["type"];
            codes.push(
                `${NEW_LINE}if (this.${item["name"]} !== null && this.${item[
                    "name"
                ]} !== undefined) {${NEW_LINE}output.writeFieldBegin('${item[
                    "name"
                ]}', ${getThriftTypeStr(type)}, ${index +
                    1})${NEW_LINE}output.${getWriterStr(type)}(this.${item[
                    "name"
                ]})${NEW_LINE}output.writeFieldEnd()${NEW_LINE}}`
            );
        });
        codes.push(
            `${NEW_LINE}output.writeFieldStop()${NEW_LINE}output.writeStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // close block
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    // Structs
    const structsHandler = (values: object[]): string => {
        let structs = [];
        Object.keys(values).forEach(key => {
            structs.push(structHandler(key, values[key]));
        });
        return structs.join("");
    };

    const structHandler = (name, items: object[]): string => {
        let codes = [];
        codes.push(`${NEW_LINE}export class ${name} {`);
        items.forEach((item, index) => {
            codes.push(`${NEW_LINE}${item["name"]}`);
            if (item["option"] === "optional") {
                codes.push("?");
            }
            codes.push(`: ${valueTypeTransformer(item["type"])};`);
        });
        codes.push(`${NEW_LINE}name: string;`);

        // add constructor
        codes.push(`${NEW_LINE}${NEW_LINE}constructor (args?) {`);
        codes.push(`${NEW_LINE}this.name = "${name}"`);
        items.forEach((item, index) => {
            let value = item["value"];
            if (value !== undefined) {
                if (item["type"] === "string") {
                    value = `"${value}"`;
                }
                codes.push(`${NEW_LINE}this.${item["name"]} = ${value}`);
            } else {
                codes.push(`${NEW_LINE}this.${item["name"]} = null`);
            }
        });
        codes.push(`${NEW_LINE}if (args) {`);
        items.forEach((item, index) => {
            let paramName = item["name"];
            codes.push(
                `${NEW_LINE}if (args.${paramName} !== undefined && args.${paramName} !== null) {${NEW_LINE}this.${paramName} = args.${paramName}${NEW_LINE}}`
            );
        });
        codes.push(`${NEW_LINE}}`);
        // close constructor
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        // add read function
        codes.push(
            `${NEW_LINE}read = (input: IProtocol) => {${NEW_LINE}input.readStructBegin()${NEW_LINE}while (true) {${NEW_LINE}let ret = input.readFieldBegin()${NEW_LINE}let fname = ret.fname${NEW_LINE}let ftype = ret.ftype${NEW_LINE}let fid = ret.fid${NEW_LINE}if (ftype === ThriftType.STOP) {${NEW_LINE}break${NEW_LINE}}${NEW_LINE}switch (fid) {`
        );
        items.forEach((item, index) => {
            let type = item["type"];
            codes.push(
                `${NEW_LINE}case ${index +
                    1}:${NEW_LINE}if (ftype === ${getThriftTypeStr(
                    type
                )}) {${NEW_LINE}this.${item["name"]} = input.${getReaderStr(
                    type
                )}${NEW_LINE}} else {${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}break`
            );
        });
        codes.push(
            `${NEW_LINE}default:${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}input.readFieldEnd()${NEW_LINE}}${NEW_LINE}input.readStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // add write function
        codes.push(
            `${NEW_LINE}${NEW_LINE}write = (output: IProtocol) => {${NEW_LINE}output.writeStructBegin('${name}')`
        );
        items.forEach((item, index) => {
            let type = item["type"];
            codes.push(
                `${NEW_LINE}if (this.${item["name"]} !== null && this.${item[
                    "name"
                ]} !== undefined) {${NEW_LINE}output.writeFieldBegin('${item[
                    "name"
                ]}', ${getThriftTypeStr(type)}, ${index +
                    1})${NEW_LINE}output.${getWriterStr(type)}(this.${item[
                    "name"
                ]})${NEW_LINE}output.writeFieldEnd()${NEW_LINE}}`
            );
        });
        codes.push(
            `${NEW_LINE}output.writeFieldStop()${NEW_LINE}output.writeStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // close block
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    const structsLikeHandler = (values: object[]): string => {
        let interfaces = [];
        Object.keys(values).forEach(key => {
            interfaces.push(structLikeHandler(key, values[key]));
        });
        return interfaces.join("");
    };

    const structLikeHandler = (name, items: object[]): string => {
        let codes = [`${NEW_LINE}export interface ${name} {`];
        items.forEach((item, index) => {
            codes.push(`${NEW_LINE}${item["name"]}`);
            if (item["option"] === "optional") {
                codes.push("?");
            }
            codes.push(`: ${valueTypeTransformer(item["type"])};`);
        });
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    const servicesHandler = (services: object[]): string => {
        let codes = [];
        Object.keys(services).forEach(key => {
            codes.push(serviceArgsndResultsHandler(key, services[key]));
            codes.push(serviceHandler(key, services[key]));
        });
        return codes.join("");
    };

    const serviceArgsndResultsHandler = (name, service): string => {
        let codes = [];
        let functions = service["functions"];

        // function blocks
        Object.keys(functions).forEach(key => {
            let func = functions[key];
            // args
            codes.push(serviceArgHandler(name, func));

            // result
            codes.push(serviceResultHandler(name, func));
        });

        return codes.join("");
    };

    const serviceArgHandler = (service, func): string => {
        let codes = [];
        let args = func["args"];
        let name = `${service}_${func["name"]}_args`;

        codes.push(`${NEW_LINE}export class ${name} {`);

        args.forEach((arg, index) => {
            codes.push(`${NEW_LINE}${arg["name"]}`);
            if (arg["option"] === "optional") {
                codes.push("?");
            }
            codes.push(`: ${valueTypeTransformer(arg["type"])};`);
        });
        codes.push(`${NEW_LINE}name: string;`);

        // add constructor
        codes.push(`${NEW_LINE}${NEW_LINE}constructor (args?) {`);
        codes.push(`${NEW_LINE}this.name = "${name}"`);
        args.forEach((arg, index) => {
            let value = arg["value"];
            if (value !== undefined) {
                if (arg["type"] === "string") {
                    value = `"${value}"`;
                }
                codes.push(`${NEW_LINE}this.${arg["name"]} = ${value}`);
            } else {
                codes.push(`${NEW_LINE}this.${arg["name"]} = null`);
            }
        });

        if (args && args.length) {
            codes.push(`${NEW_LINE}if (args) {`);
            args.forEach((item, index) => {
                let paramName = item["name"];
                let value = `args.${paramName}`;

                if (mapThriftType(item["type"]) === "struct") {
                    // TODO check more
                    value = `new ${item["type"]}(${value})`;
                }
                codes.push(
                    `${NEW_LINE}if (args.${paramName} !== undefined && args.${paramName} !== null) {${NEW_LINE}this.${paramName} = ${value}${NEW_LINE}}`
                );
            });
            codes.push(`${NEW_LINE}}`);
        }

        // close constructor
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        // add read function
        codes.push(
            `${NEW_LINE}read = (input: IProtocol) => {${NEW_LINE}input.readStructBegin()${NEW_LINE}while (true) {${NEW_LINE}let ret = input.readFieldBegin()${NEW_LINE}let fname = ret.fname${NEW_LINE}let ftype = ret.ftype${NEW_LINE}let fid = ret.fid${NEW_LINE}if (ftype === ThriftType.STOP) {${NEW_LINE}break${NEW_LINE}}`
        );

        if (args && args.length) {
            codes.push(`${NEW_LINE}switch (fid) {`);
            args.forEach((item, index) => {
                let type = item["type"];
                codes.push(
                    `${NEW_LINE}case ${index +
                        1}:${NEW_LINE}if (ftype === ${getThriftTypeStr(
                        type
                    )}) {${NEW_LINE}`
                );
                if (mapThriftType(type) === "struct") {
                    codes.push(
                        `this.${item[
                            "name"
                        ]} = new ${type}()${NEW_LINE}this.${item[
                            "name"
                        ]}.read(input)`
                    );
                } else {
                    codes.push(
                        `this.${item["name"]} = input.${getReaderStr(type)}`
                    );
                }

                codes.push(
                    `${NEW_LINE}} else {${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}break`
                );
            });
            codes.push(
                `${NEW_LINE}default:${NEW_LINE}input.skip(ftype)${NEW_LINE}}`
            );
        } else {
            codes.push(`${NEW_LINE}input.skip(ftype)`);
        }

        codes.push(
            `${NEW_LINE}input.readFieldEnd()${NEW_LINE}}${NEW_LINE}input.readStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // add write function
        codes.push(
            `${NEW_LINE}${NEW_LINE}write = (output: IProtocol) => {${NEW_LINE}output.writeStructBegin('${name}')`
        );
        args.forEach((item, index) => {
            let type = item["type"];
            codes.push(
                `${NEW_LINE}if (this.${item["name"]} !== null && this.${item[
                    "name"
                ]} !== undefined) {${NEW_LINE}output.writeFieldBegin('${item[
                    "name"
                ]}', ${getThriftTypeStr(type)}, ${index + 1})${NEW_LINE}`
            );

            if (mapThriftType(type) === "struct") {
                codes.push(`this.${item["name"]}.write(output)`);
            } else {
                codes.push(
                    `output.${getWriterStr(type)}(this.${item["name"]})`
                );
            }
            codes.push(`${NEW_LINE}output.writeFieldEnd()${NEW_LINE}}`);
        });
        codes.push(
            `${NEW_LINE}output.writeFieldStop()${NEW_LINE}output.writeStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // close block
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    const serviceResultHandler = (service, func): string => {
        let codes = [];
        let throws = func["throws"];
        let name = `${service}_${func["name"]}_result`;

        codes.push(`${NEW_LINE}export class ${name} {`);

        codes.push(`${NEW_LINE}name: string;`);
        codes.push(`${NEW_LINE}success: any;`);
        if (throws && throws.length) {
            throws.forEach((item, index) => {
                codes.push(`${NEW_LINE}${item["name"]}: ${item["type"]};`);
            });
        }

        // add constructor
        codes.push(`${NEW_LINE}${NEW_LINE}constructor (args?) {`);
        codes.push(`${NEW_LINE}this.name = "${name}"`);
        if (func["type"] !== "void") {
            codes.push(`${NEW_LINE}this.success = null`);
            throws.forEach((item, index) => {
                codes.push(`${NEW_LINE}this.${item["name"]} = null`);
            });
            throws.forEach((item, index) => {
                codes.push(
                    `${NEW_LINE}if (args instanceof ${item[
                        "type"
                    ]}) {${NEW_LINE}this.${item[
                        "name"
                    ]} = args${NEW_LINE}return${NEW_LINE}}`
                );
            });
            codes.push(`${NEW_LINE}if (args) {`);
            codes.push(
                `${NEW_LINE}if (args.success !== undefined && args.success !== null) {${NEW_LINE}this.success = args.success${NEW_LINE}}`
            );
            throws.forEach((item, index) => {
                codes.push(
                    `${NEW_LINE}if (args.${item[
                        "name"
                    ]} !== undefined && args.${item[
                        "name"
                    ]} !== null) {${NEW_LINE}this.${item["name"]} = args.${item[
                        "name"
                    ]}${NEW_LINE}}`
                );
            });
            codes.push(`${NEW_LINE}}`);
        }
        // close constructor
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        // add read function
        codes.push(
            `${NEW_LINE}read = (input: IProtocol) => {${NEW_LINE}input.readStructBegin()${NEW_LINE}while (true) {${NEW_LINE}let ret = input.readFieldBegin()${NEW_LINE}let fname = ret.fname${NEW_LINE}let ftype = ret.ftype${NEW_LINE}let fid = ret.fid${NEW_LINE}if (ftype === ThriftType.STOP) {${NEW_LINE}break${NEW_LINE}}`
        );
        if (func["type"] !== "void") {
            codes.push(`${NEW_LINE}switch (fid) {`);
            codes.push(
                `${NEW_LINE}case 0:${NEW_LINE}if (ftype === ${getThriftTypeStr(
                    func["type"]
                )}) {${NEW_LINE}this.success = input.${getReaderStr(
                    func["type"]
                )}${NEW_LINE}} else {${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}break`
            );

            if (throws && throws.length) {
                throws.forEach((item, index) => {
                    codes.push(
                        `${NEW_LINE}case ${index +
                            1}:${NEW_LINE}if (ftype === ${getThriftTypeStr(
                            item["type"]
                        )}) {${NEW_LINE}this.${item["name"]} = new ${item[
                            "type"
                        ]}()${NEW_LINE}this.${item[
                            "name"
                        ]}.read(input)${NEW_LINE}} else {${NEW_LINE}input.skip(ftype)${NEW_LINE}}${NEW_LINE}break`
                    );
                });
            }
            codes.push(
                `${NEW_LINE}default:${NEW_LINE}input.skip(ftype)${NEW_LINE}}`
            );
        } else {
            codes.push(`${NEW_LINE}input.skip(ftype)`);
        }
        codes.push(
            `${NEW_LINE}input.readFieldEnd()${NEW_LINE}}${NEW_LINE}input.readStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // add write function
        codes.push(
            `${NEW_LINE}${NEW_LINE}write = (output: IProtocol) => {${NEW_LINE}output.writeStructBegin('${name}')`
        );

        if (func["type"] !== "void") {
            codes.push(
                `${NEW_LINE}if (this.success !== null && this.success !== undefined) {${NEW_LINE}output.writeFieldBegin('success', ${getThriftTypeStr(
                    func["type"]
                )}, 0)${NEW_LINE}output.${getWriterStr(
                    func["type"]
                )}(this.success)${NEW_LINE}output.writeFieldEnd()${NEW_LINE}}`
            );
        }
        if (throws && throws.length) {
            throws.forEach((item, index) => {
                codes.push(
                    `${NEW_LINE}if (this.${item[
                        "name"
                    ]} !== null && this.${item[
                        "name"
                    ]} !== undefined) {${NEW_LINE}output.writeFieldBegin('${item[
                        "name"
                    ]}', ${getThriftTypeStr(item["type"])}, ${index +
                        1})${NEW_LINE}this.${item[
                        "name"
                    ]}.write(output)${NEW_LINE}output.writeFieldEnd()${NEW_LINE}}`
                );
            });
        }

        codes.push(
            `${NEW_LINE}output.writeFieldStop()${NEW_LINE}output.writeStructEnd()${NEW_LINE}return${NEW_LINE}}`
        );

        // close block
        codes.push(`${NEW_LINE}}${NEW_LINE}`);

        return codes.join("");
    };

    const serviceHandler = (name, service): string => {
        let codes = [];
        let functions = service["functions"];
        codes.push(`${NEW_LINE}export class ${name + "Client"}`);
        if (service["extends"]) {
            codes.push(` extends ${service["extends"] + "Client"}`);
        }
        codes.push(
            ` {${NEW_LINE}output: ITransport;${NEW_LINE}pClass: ProtocolClass;${NEW_LINE}id: number;${NEW_LINE}reqs: { [key: string]: any }`
        );

        // constructor block
        codes.push(
            `${NEW_LINE}${NEW_LINE}constructor (output: ITransport, pClass: ProtocolClass) {`
        );
        if (service["extends"]) {
            codes.push(`${NEW_LINE}super(output, pClass)`);
        }
        codes.push(
            `${NEW_LINE}this.output = output${NEW_LINE}this.pClass = pClass${NEW_LINE}this.id = 0${NEW_LINE}this.reqs = {}${NEW_LINE}}`
        );

        // function blocks
        Object.keys(functions).forEach(key => {
            let func = functions[key];
            let args = func["args"];
            let argStrs = args.map(x => x.name).join(", ");
            // func
            codes.push(
                `${NEW_LINE}${NEW_LINE}${key} = (${argStrs
                    ? argStrs + ", callback"
                    : "callback"}) => {${NEW_LINE}if (callback === undefined) {${NEW_LINE}let self = this${NEW_LINE}return new Promise(function (resolve, reject) {${NEW_LINE}self.reqs[self.id] = (err, result) => {${NEW_LINE}if (err) {${NEW_LINE}reject(err)${NEW_LINE}} else {${NEW_LINE}resolve(result)${NEW_LINE}}${NEW_LINE}}${NEW_LINE}self.send_${key}(${argStrs})${NEW_LINE}})${NEW_LINE}} else {${NEW_LINE}this.reqs[this.id] = callback${NEW_LINE}this.send_${key}(${argStrs})${NEW_LINE}}${NEW_LINE}}`
            );

            // send_func
            codes.push(
                `${NEW_LINE}${NEW_LINE}send_${key} = (${argStrs}) => {${NEW_LINE}let output = new this.pClass(this.output)${NEW_LINE}output.writeMessageBegin('${key}', MessageType.CALL, this.id)${NEW_LINE}let args = new ${name}_${key}_args({${argStrs}})${NEW_LINE}args.write(output)${NEW_LINE}output.writeMessageEnd()${NEW_LINE}return this.output.flush()${NEW_LINE}}`
            );

            // recv_func
            if (func["oneway"] !== true) {
                codes.push(
                    `${NEW_LINE}${NEW_LINE}recv_${key} = (input, mtype, rseqid) => {${NEW_LINE}let callback = this.reqs[rseqid] || function () { }${NEW_LINE}delete this.reqs[rseqid]${NEW_LINE}if (mtype === MessageType.EXCEPTION) {${NEW_LINE}let x = new TApplicationException()${NEW_LINE}x.read(input)${NEW_LINE}input.readMessageEnd()${NEW_LINE}return callback(x)${NEW_LINE}}${NEW_LINE}let result = new ${name}_${key}_result()${NEW_LINE}result.read(input)${NEW_LINE}input.readMessageEnd()${NEW_LINE}`
                );
                ////// -- throws
                let throws = func["throws"];
                throws.forEach((item, index) => {
                    codes.push(
                        `${NEW_LINE}if (null !== result.${item[
                            "name"
                        ]}) {${NEW_LINE}throw result.${item[
                            "name"
                        ]}${NEW_LINE}}`
                    );
                });

                codes.push(
                    `${NEW_LINE}if (null !== result.success) {${NEW_LINE}return callback(null, result.success)${NEW_LINE}}${NEW_LINE}return callback('${key} failed: unknown result')${NEW_LINE}}`
                );
            }
        });

        // close class block
        codes.push(`${NEW_LINE}}`);

        defaultExports.push(name + "Client");

        return codes.join("");
    };

    const defaultExportsHandler = (): string => {
        let code = `${NEW_LINE_2}export default {${NEW_LINE}`;
        defaultExports.forEach((v, i) => {
            code += v;
            if (i < defaultExports.length - 1) {
                code += ",";
            }
            code += `${NEW_LINE}`;
        });
        code += `}${NEW_LINE}`;
        return code;
    };

    // includes -> import
    if (ast.include) {
        code += includesHandler(ast.include);
    }

    // const -> const
    if (ast.const) {
        code += constsHandler(ast.const);
    }

    // enum -> interface
    if (ast.enum) {
        code += enumsHandler(ast.enum);
    }

    // exception -> class extends TException
    if (ast.exception) {
        code += exceptionsHandler(ast.exception);
    }

    // struct -> class
    if (ast.struct) {
        code += structsHandler(ast.struct);
    }

    // union -> interface
    if (ast.union) {
        code += structsLikeHandler(ast.union);
    }

    // service -> functions
    if (ast.service) {
        code += servicesHandler(ast.service);
    }

    // default export
    if (ast.service) {
        code += defaultExportsHandler();
    }

    return prettier.format(code, prettierConfig);
};

export const clientsIndex = clientsDict => {
    let codes = [
        `/**${NEW_LINE} * This file is auto-generated by Thrift2Ts.${NEW_LINE} *${NEW_LINE} * ${new Date().toString()}${NEW_LINE} */${NEW_LINE_2}`
    ];

    const files = Object.keys(clientsDict);
    if (files.length < 1) {
        return codes.join("");
    }

    let allClients = [];
    // import clients
    files.forEach(file => {
        let clients = clientsDict[file];
        if (clients.length > 0) {
            allClients = allClients.concat(clients);
            codes.push(
                `import { ${clients.map(
                    x => x + "Client"
                )} } from "./${file}"${NEW_LINE}`
            );
        }
    });

    // export
    codes.push(
        `${NEW_LINE_2}export default {${NEW_LINE}${allClients
            .map(x => x + ":" + x + "Client")
            .join(`,${NEW_LINE}`)}${NEW_LINE}}${NEW_LINE}`
    );

    return prettier.format(codes.join(""), prettierConfig);
};
