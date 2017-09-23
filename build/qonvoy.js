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
/**
 * Initialize Qonvoy
 * @param c
 */
function init(c) {
    config = c;
    Connection.init(c.redisConnectionString);
}
exports.init = init;
/**
 * Get Client
 * returns redis client that powers Qonvoy
 */
function getClient() {
    return Connection.client;
}
exports.getClient = getClient;
/**
 * Get Timestamp
 * @param seconds
 */
function getTimestamp(seconds = 0) {
    return (new Date().getTime()) + (seconds * 1000);
}
exports.getTimestamp = getTimestamp;
/**
 * Modify Timestamp
 * modifies a timestamp value by x seconds
 * @param timestamp
 * @param seconds
 */
function modifyTimestamp(timestamp, seconds = 0) {
    return timestamp + (seconds * 1000);
}
exports.modifyTimestamp = modifyTimestamp;
/**
 * Add
 * adds a task to named queue
 * @param queue
 * @param meta
 */
function add(queue, meta) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp = getTimestamp();
        let id = uuid();
        let item = {};
        item.id = id;
        item.created = timestamp;
        item.queue = queue;
        item.attempts = 0;
        item.success = false;
        item.error = '';
        item.meta = meta;
        yield Connection.client
            .multi()
            .zadd(`queue:${queue}`, timestamp, id)
            .hmset(`items:${queue}:${id}`, 'id', item.id, 'created', item.created, 'queue', item.queue, 'attempts', item.attempts, 'success', item.success, 'error', '', 'meta', JSON.stringify(item.meta))
            .exec();
        return id;
    });
}
exports.add = add;
/**
 * Status
 * returns status of job by id
 * @param queue
 * @param id
 */
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
/**
 * Process Next
 * processes next task from named queue
 * @param queue
 * @param func
 */
function processNext(queue, func) {
    return __awaiter(this, void 0, void 0, function* () {
        let success = false;
        let timestamp = getTimestamp();
        let result = yield Connection.client
            .eval(LuaCommands.getNext(), 3, `queue:${queue}`, `processing:${queue}`, timestamp + '');
        if (result) {
            success = yield runTask(queue, result, func);
        }
        return success;
    });
}
exports.processNext = processNext;
/**
 * Process One
 * process task by id from named queue
 * @param queue
 * @param id
 * @param func
 */
function processOne(queue, id, func) {
    return __awaiter(this, void 0, void 0, function* () {
        let success = false;
        let timestamp = getTimestamp();
        let result = yield Connection.client
            .eval(LuaCommands.getOne(), 4, `queue:${queue}`, `processing:${queue}`, timestamp + '', id);
        if (result) {
            success = yield runTask(queue, result, func);
        }
        return success;
    });
}
exports.processOne = processOne;
/**
 * Re-Queue
 * moves any stuck jobs from the processing queue back to pending
 * @param queue
 * @param minAge
 */
function reQueue(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp;
        if (minAge) {
            timestamp = minAge;
        }
        else {
            timestamp = getTimestamp();
        }
        let result = yield Connection.client
            .zrangebyscore(`processing:${queue}`, '-inf', timestamp);
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
/**
 * Count Successes
 * returns number of current successes from named queue
 * @param queue
 */
function countSuccesses(queue) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = yield Connection.client
            .zcard(`success:${queue}`);
        return result;
    });
}
exports.countSuccesses = countSuccesses;
/**
 * Count Errors
 * returns number of current errors from named queue
 * @param queue
 */
function countErrors(queue) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = yield Connection.client
            .zcard(`error:${queue}`);
        return result;
    });
}
exports.countErrors = countErrors;
/**
 * Report Successes
 * returns success log from named queue
 * @param queue
 * @param minAge
 */
function reportSuccesses(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp;
        if (minAge) {
            timestamp = minAge;
        }
        else {
            timestamp = getTimestamp();
        }
        let result = yield Connection.client
            .zrangebyscore(`success:${queue}`, '-inf', timestamp);
        return result;
    });
}
exports.reportSuccesses = reportSuccesses;
/**
 * Report Errors
 * returns error log from named queue
 * @param queue
 * @param minAge
 */
function reportErrors(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp;
        if (minAge) {
            timestamp = minAge;
        }
        else {
            timestamp = getTimestamp();
        }
        let result = yield Connection.client
            .zrangebyscore(`error:${queue}`, '-inf', timestamp);
        return result;
    });
}
exports.reportErrors = reportErrors;
/**
 * Clear Successes
 * clears success log from named queue
 * @param queue
 * @param minAge
 */
function clearSuccesses(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp;
        if (minAge) {
            timestamp = minAge;
        }
        else {
            timestamp = getTimestamp();
        }
        let result = yield Connection.client
            .zremrangebyscore(`success:${queue}`, '-inf', timestamp);
        return result;
    });
}
exports.clearSuccesses = clearSuccesses;
/**
 * Clear Errors
 * clears error log from the named queue
 * @param queue
 * @param minAge
 */
function clearErrors(queue, minAge) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp;
        if (minAge) {
            timestamp = minAge;
        }
        else {
            timestamp = getTimestamp();
        }
        let result = yield Connection.client
            .zremrangebyscore(`error:${queue}`, '-inf', timestamp);
        return result;
    });
}
exports.clearErrors = clearErrors;
/**
 * Destroy
 * manually destroy a task by id
 * @param queue
 * @param id
 */
function destroy(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Connection.client
            .multi()
            .zrem(`queue:${queue}`, id)
            .zrem(`processing:${queue}`, id)
            .zrem(`success:${queue}`, id)
            .zrem(`error:${queue}`, id)
            .hrem(`items:${queue}:${id}`)
            .exec();
        return true;
    });
}
exports.destroy = destroy;
/**
 * Retry
 * moves a task from the error log to the queue
 * @param queue
 * @param id
 */
function retry(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let timestamp = getTimestamp();
        yield Connection.client
            .multi()
            .persist(`items:${queue}:${id}`)
            .zrem(`error:${queue}`, id)
            .zadd(`queue:${queue}`, timestamp, id)
            .exec();
        return true;
    });
}
exports.retry = retry;
/**
 * Load
 * de-serializes from redis hash to Item by id
 * @param queue
 * @param id
 */
function load(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        let data = yield Connection.client.hgetall(`items:${queue}:${id}`);
        if (!data) {
            return null;
        }
        let item = {
            id: data.id,
            created: parseInt(data.created),
            queue: data.queue,
            attempts: parseInt(data.attempts),
            success: (data.success === 'true'),
            error: data.error,
            meta: JSON.parse(data.meta)
        };
        return item;
    });
}
/**
 * Run Task
 * task running/logging logic
 * @param queue
 * @param id
 * @param func
 */
function runTask(queue, id, func) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Connection.client.hincrby(`items:${queue}:${id}`, 'attempts', 1);
        let item = yield load(queue, id);
        if (!item) {
            return false;
        }
        try {
            let success = yield func(item);
            let completedTimestamp = getTimestamp();
            if (success) {
                yield Connection.client
                    .multi()
                    .zrem(`processing:${item.queue}`, item.id)
                    .hset(`items:${item.queue}:${item.id}`, 'success', 'true')
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
            let completedTimestamp = getTimestamp();
            yield Connection.client
                .multi()
                .zrem(`processing:${item.queue}`, item.id)
                .zadd(`error:${item.queue}`, completedTimestamp, item.id)
                .hset(`items:${item.queue}:${item.id}`, 'error', err.message)
                .expire(`items:${item.queue}:${item.id}`, config.retention || 60 * 60 * 24)
                .exec();
        }
        return false;
    });
}
