import clients from "./clients";

import ThriftBrowser from "browser-thrift2";
const {
    TJSONProtocol,
    TBufferedTransport,
    createWSConnection,
    createXHRConnection,
    createClient
} = ThriftBrowser;

/**
 * Please replace the host, port, and other options for connecting RPC server
 */
let conn = createXHRConnection("localhost", 9090, {
    path: "/thrift/rpc"
});

conn.on("error", err => {
    console.dir(err);
});

export default function thriftRPC<T>(method, params): Promise<T> {
    let splits: string[] = method.split(".").map(x => x !== "");
    if (splits.length < 2) {
        throw new Error(
            "Invalid RPC method, the correct format is `ServiceName.MethodName`"
        );
    }
    let service = splits[0];
    let func = splits[1];

    let client = createClient(clients[service], conn);
    return new Promise((resolve, reject) => {
        try {
            client[func](
                ...Object.keys(params).map(key => params[key]),
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}
