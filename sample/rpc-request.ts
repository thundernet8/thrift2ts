/**
 * A sample RPC request implementation
 */

import axios from "axios";

const rpcAddress = "http://test.com/service/rpc";

const request = axios.create({
    baseURL: rpcAddress,
    timeout: 1000,
    headers: { "Content-Type": "text/plain;charset:utf-8" }
});

let _id = 0;
export default function jsonRPC(method, params) {
    return request.post({
        id: _id++,
        method,
        params
    });
}
