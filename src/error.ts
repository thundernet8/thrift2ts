export class ThriftSyntaxError extends SyntaxError {
    public context: string;
    public line: number;

    constructor(message, context, line) {
        super(message);
        this.context = context;
        this.line = line;
        this.name = 'THRIFT_SYNTAX_ERROR'
    }
}
