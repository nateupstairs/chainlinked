"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Redis = require('promise-redis')();
exports.client = null;
function init(connectionString) {
    exports.client = Redis.createClient(connectionString);
}
exports.init = init;
