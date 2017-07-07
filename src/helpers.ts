// Helpers
export const thrift2TsPath = (
    path: string,
    ext: boolean = false,
    isService: boolean = true
): string => {
    path = path.replace(/(.*)\.thrift$/i, isService ? "$1Service" : "$1Client");
    if (!path.startsWith(".")) {
        path = "./" + path;
    }
    return ext ? path + ".ts" : path;
};

export const getThriftFileName = (path: string): string => {
    let reg = /([\.\/]?)([^\/\.]+)\.thrift$/i;
    let match = path.match(reg);
    if (match.length >= 3) {
        return match[2];
    }
    return "";
};
