"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ThriftSyntaxError extends SyntaxError {
    constructor(message, context, line) {
        super(message);
        this.context = context;
        this.line = line;
        this.name = 'THRIFT_SYNTAX_ERROR';
    }
}
exports.ThriftSyntaxError = ThriftSyntaxError;
