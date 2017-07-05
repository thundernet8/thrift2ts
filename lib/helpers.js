"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.thrift2TsPath = (path, ext = false, isService = true) => {
    path = path.replace(/(.*)\.thrift$/i, isService ? '$1Service' : '$1Client');
    if (!path.startsWith(".")) {
        path = "./" + path;
    }
    return ext ? path + '.ts' : path;
};
exports.getThriftFileName = (path) => {
    let reg = /([\.\/]?)([^\/\.]+)\.thrift$/i;
    let match = path.match(reg);
    if (match.length >= 3) {
        return match[2];
    }
    return '';
};
