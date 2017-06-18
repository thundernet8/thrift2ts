"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.thrift2TsPath = (path, ext = false) => {
    path = path.replace(/(.*)\.thrift$/i, '$1Service');
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
