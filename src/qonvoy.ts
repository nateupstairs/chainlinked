const uuid = require('uuid/v4')

import * as Connection from './connection'
import * as LuaCommands from './luaCommands'

export interface Config {
    redisConnectionString: string,
    retention?: number
}

export interface Item {
    id: string,
    created: number,
    queue: string,
    attempts: number,
    success: boolean,
    error: string,
    meta: any
}

var config: Config = null

/**
 * Initialize Qonvoy
 * @param c 
 */
export function init(c: Config) {
    config = c
    Connection.init(c.redisConnectionString)
}

/**
 * Get Client
 * returns redis client that powers Qonvoy
 */
export function getClient() {
    return Connection.client
}

/**
 * Get Timestamp
 * @param seconds 
 */
export function getTimestamp(seconds: number = 0) {
    return (new Date().getTime()) + (seconds * 1000)
}

/**
 * Modify Timestamp
 * modifies a timestamp value by x seconds
 * @param timestamp 
 * @param seconds 
 */
export function modifyTimestamp(timestamp: number, seconds: number = 0) {
    return timestamp + (seconds * 1000)
}

/**
 * Add
 * adds a task to named queue
 * @param queue 
 * @param meta 
 */
export async function add(queue: string, meta: any) {
    let timestamp = getTimestamp()
    let id = uuid()
    let item = <Item>{}

    item.id = id
    item.created = timestamp
    item.queue = queue
    item.attempts = 0
    item.success = false
    item.error = ''
    item.meta = meta
    
    await Connection.client
        .multi()
        .zadd(`queue:${queue}`, timestamp, id)
        .hmset(
            `items:${queue}:${id}`,
            'id', item.id,
            'created', item.created,
            'queue', item.queue,
            'attempts', item.attempts,
            'success', item.success,
            'error', '',
            'meta', JSON.stringify(item.meta)
        )
        .exec()
    
    return id
}

/**
 * Status
 * returns status of job by id
 * @param queue 
 * @param id 
 */
export async function status(queue: string, id: string) {
    let item = await load(queue, id)
    
    if (!item) {
        return null
    }

    return item
}

/**
 * Process Next
 * processes next task from named queue
 * @param queue 
 * @param func 
 */
export async function processNext(
    queue: string,
    func: (item: Item) => Promise<boolean>
) {
    let success: boolean = false
    let timestamp = getTimestamp()
    let result = await Connection.client
        .eval(
            LuaCommands.getNext(),
            3,
            `queue:${queue}`,
            `processing:${queue}`,
            timestamp + ''
        )
    
    if (result) {
        success = await runTask(queue, result, func)
    }
    
    return success
}

/**
 * Process One
 * process task by id from named queue
 * @param queue 
 * @param id 
 * @param func 
 */
export async function processOne(
    queue: string,
    id: string,
    func: (item: any) => Promise<boolean>
) {
    let success: boolean = false
    let timestamp = getTimestamp()
    let result = await Connection.client
        .eval(
            LuaCommands.getOne(),
            4,
            `queue:${queue}`,
            `processing:${queue}`,
            timestamp + '',
            id
        )
        
    if (result) {
        success = await runTask(queue, result, func)
    }
    
    return success
}

/**
 * Re-Queue
 * moves any stuck jobs from the processing queue back to pending
 * @param queue 
 * @param minAge 
 */
export async function reQueue(queue: string, minAge?: number) {
    let timestamp
    
    if (minAge) {
        timestamp = minAge
    }
    else {
        timestamp = getTimestamp()
    }

    let result = await Connection.client
        .zrangebyscore(`processing:${queue}`, '-inf', timestamp)

    if (result) {
        for (let id of result) {
            await Connection.client
                .multi()
                .zrem(`processing:${queue}`, id)
                .zadd(`queue:${queue}`, timestamp, id)
                .exec()
        }
    }

    return true
}

/**
 * Count Successes
 * returns number of current successes from named queue
 * @param queue 
 */
export async function countSuccesses(queue: string) {
    let result = await Connection.client
        .zcard(`success:${queue}`)

    return result
}

/**
 * Count Errors
 * returns number of current errors from named queue
 * @param queue 
 */
export async function countErrors(queue: string) {
    let result = await Connection.client
        .zcard(`error:${queue}`)

    return result
}

/**
 * Report Successes
 * returns success log from named queue
 * @param queue 
 * @param minAge 
 */
export async function reportSuccesses(queue: string, minAge?: number) {
    let timestamp
    
    if (minAge) {
        timestamp = minAge
    }
    else {
        timestamp = getTimestamp()
    }

    let result = await Connection.client
        .zrangebyscore(`success:${queue}`, '-inf', timestamp)

    return result
}

/**
 * Report Errors
 * returns error log from named queue
 * @param queue 
 * @param minAge 
 */
export async function reportErrors(queue: string, minAge?: number) {
    let timestamp
    
    if (minAge) {
        timestamp = minAge
    }
    else {
        timestamp = getTimestamp()
    }

    let result = await Connection.client
        .zrangebyscore(`error:${queue}`, '-inf', timestamp)

    return result
}

/**
 * Clear Successes
 * clears success log from named queue
 * @param queue 
 * @param minAge 
 */
export async function clearSuccesses(queue: string, minAge?: number) {
    let timestamp
    
    if (minAge) {
        timestamp = minAge
    }
    else {
        timestamp = getTimestamp()
    }

    let result = await Connection.client
        .zremrangebyscore(`success:${queue}`, '-inf', timestamp)

    return result
}

/**
 * Clear Errors
 * clears error log from the named queue
 * @param queue 
 * @param minAge 
 */
export async function clearErrors(queue: string, minAge?: number) {
    let timestamp
    
    if (minAge) {
        timestamp = minAge
    }
    else {
        timestamp = getTimestamp()
    }

    let result = await Connection.client
        .zremrangebyscore(`error:${queue}`, '-inf', timestamp)

    return result
}

/**
 * Destroy
 * manually destroy a task by id
 * @param queue 
 * @param id 
 */
export async function destroy(queue: string, id: string) {
    await Connection.client
        .multi()
        .zrem(`queue:${queue}`, id)
        .zrem(`processing:${queue}`, id)
        .zrem(`success:${queue}`, id)
        .zrem(`error:${queue}`, id)
        .hrem(`items:${queue}:${id}`)
        .exec()
    
    return true
}

/**
 * Retry
 * moves a task from the error log to the queue
 * @param queue 
 * @param id 
 */
export async function retry(queue: string, id: string) {
    let timestamp = getTimestamp()
    
    await Connection.client
        .multi()
        .persist(`items:${queue}:${id}`)
        .zrem(`error:${queue}`, id)
        .zadd(`queue:${queue}`, timestamp, id)
        .exec()

    return true
}

/**
 * Load
 * de-serializes from redis hash to Item by id
 * @param queue 
 * @param id 
 */
async function load(queue: string, id: string) {
    let data = await Connection.client.hgetall(`items:${queue}:${id}`)
    
    if (!data) {
        return null
    }
    
    let item = <Item>{
        id: data.id,
        created: parseInt(data.created),
        queue: data.queue,
        attempts: parseInt(data.attempts),
        success: (data.success === 'true'),
        error: data.error,
        meta: JSON.parse(data.meta)
    }

    return item
}

/**
 * Run Task
 * task running/logging logic
 * @param queue 
 * @param id 
 * @param func 
 */
async function runTask(
    queue: string,
    id: string,
    func: (item: any) => Promise<boolean>
) {
    await Connection.client.hincrby(
        `items:${queue}:${id}`,
        'attempts',
        1
    )

    let item = await load(queue, id)

    if (!item) {
        return false
    }
    
    try {
        let success: boolean = await func(item)
        let completedTimestamp = getTimestamp()
        
        if (success) {
            await Connection.client
                .multi()
                .zrem(`processing:${item.queue}`, item.id)
                .hset(
                    `items:${item.queue}:${item.id}`,
                    'success',
                    'true'
                )
                .expire(
                    `items:${item.queue}:${item.id}`,
                    config.retention || 60*60*24
                )
                .zadd(`success:${item.queue}`, completedTimestamp, item.id)
                .exec()

            return true
        }
        else {
            throw new Error('generic processing failure')
        }
    }
    catch (err) {
        let completedTimestamp = getTimestamp()
        
        await Connection.client
            .multi()
            .zrem(`processing:${item.queue}`, item.id)
            .zadd(`error:${item.queue}`, completedTimestamp, item.id)
            .hset(
                `items:${item.queue}:${item.id}`,
                'error',
                err.message
            )
            .expire(
                `items:${item.queue}:${item.id}`,
                config.retention || 60*60*24
            )
            .exec()
    }
    
    return false
}
