var gen = require('../lib/genAst').default
var fs = require('fs')

var code = fs.readFileSync('./test/tutorial.thrift')

fs.writeFileSync('./test/ast.json', JSON.stringify(gen(code)))