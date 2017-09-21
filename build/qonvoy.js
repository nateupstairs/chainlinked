"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid = require('uuid/v4');
const Connection = require("./connection");
const LuaCommands = require("./luaCommands");
var config = null;
function init(c) {
    config = c;
    Connection.init(c.redisConnectionString);
}
exports.init = init;
function add(queue, meta) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp = new Date().getTime();
        let id = uuid();
        let item = {};
        item.id = id;
        item.created = timestamp;
        item.queue = queue;
        item.attempts = 0;
        item.success = false;
        item.errors = [];
        item.meta = meta;
        yield Connection.client
            .multi()
            .zadd(`queue:${queue}`, timestamp, id)
            .hmset(`items:${queue}:${id}`, 'id', item.id, 'created', item.created, 'queue', item.queue, 'attempts', item.attempts, 'errors', item.errors.join('|||'), 'meta', JSON.stringify(item.meta))
            .exec();
        return id;
    });
}
exports.add = add;
function status(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let item = yield load(queue, id);
        if (!item) {
            return null;
        }
        return item;
    });
}
exports.status = status;
function processNext(queue, func) {
    return __awaiter(this, void 0, void 0, function* () {
        let success = false;
        let timestamp = new Date().getTime();
        let result = yield Connection.client
            .eval(LuaCommands.getNext(), 3, `queue:${queue}`, `processing:${queue}`, timestamp + '');
        if (result) {
            success = yield runTask(queue, result, func);
        }
        return success;
    });
}
exports.processNext = processNext;
function processOne(queue, id, func) {
    return __awaiter(this, void 0, void 0, function* () {
        let success = false;
        let timestamp = new Date().getTime();
        let result = yield Connection.client
            .eval(LuaCommands.getOne(), 4, `queue:${queue}`, `processing:${queue}`, timestamp + '', id);
        if (result) {
            success = yield runTask(queue, result, func);
        }
        return success;
    });
}
exports.processOne = processOne;
function reQueue(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp = new Date().getTime();
        let cutoffTimestamp = timestamp - (minAge * 1000);
        let result = yield Connection.client
            .zrangebyscore(`processing:${queue}`, '-inf', cutoffTimestamp);
        if (result) {
            for (let id of result) {
                yield Connection.client
                    .multi()
                    .zrem(`processing:${queue}`, id)
                    .zadd(`queue:${queue}`, timestamp, id)
                    .exec();
            }
        }
        return true;
    });
}
exports.reQueue = reQueue;
function retry(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp = new Date().getTime();
        yield Connection.client
            .multi()
            .zrem(`error:${queue}`, id)
            .zadd(`queue:${queue}`, timestamp, id)
            .exec();
        return true;
    });
}
exports.retry = retry;
function load(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let data = yield Connection.client.hgetall(`items:${queue}:${id}`);
        if (!data) {
            return null;
        }
        let errors = [];
        if (data.errors !== '') {
            errors = data.errors.split(/\|\|\|/);
        }
        let item = {
            id: data.id,
            created: parseInt(data.created),
            queue: data.queue,
            attempts: parseInt(data.attempts),
            success: Boolean(data.success),
            errors: errors,
            meta: JSON.parse(data.meta)
        };
        return item;
    });
}
function runTask(queue, id, func) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Connection.client.hincrby(`items:${queue}:${id}`, 'attempts', 1);
        let item = yield load(queue, id);
        if (!item) {
            return false;
        }
        try {
            let success = yield func(item);
            let completedTimestamp = new Date().getTime();
            if (success) {
                yield Connection.client
                    .multi()
                    .zrem(`processing:${item.queue}`, item.id)
                    .expire(`items:${item.queue}:${item.id}`, config.retention || 60 * 60 * 24)
                    .zadd(`success:${item.queue}`, completedTimestamp, item.id)
                    .exec();
                return true;
            }
            else {
                throw new Error('generic processing failure');
            }
        }
        catch (err) {
            let completedTimestamp = new Date().getTime();
            yield Connection.client
                .multi()
                .zrem(`processing:${item.queue}`, item.id)
                .zadd(`error:${item.queue}`, completedTimestamp, item.id)
                .hset(`data:${item.queue}:${item.id}`, 'error', JSON.stringify(item.errors.push(err.message)))
                .exec();
        }
        return false;
    });
}
