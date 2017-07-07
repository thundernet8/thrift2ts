/**
 * A sample webApi request implementation
 */

import axios from "axios";

const apiBaseAddress = "http://test.com/api/";

const request = axios.create({
    baseURL: apiBaseAddress,
    timeout: 1000,
    headers: { "Content-Type": "application/json;charset:utf-8" }
});

export default function webApi(method, params) {
    return request.post(method.split(".").join("/"), params);
}
