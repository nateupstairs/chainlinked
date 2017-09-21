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
    errors: string[],
    meta: any
}

var config: Config = null

export function init(c: Config) {
    config = c
    Connection.init(c.redisConnectionString)
}

export async function add(queue: string, meta: any) {
    let timestamp = new Date().getTime()
    let id = uuid()
    let item = <Item>{}

    item.id = id
    item.created = timestamp
    item.queue = queue
    item.attempts = 0
    item.success = false
    item.errors = []
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
            'errors', item.errors.join('|||'),
            'meta', JSON.stringify(item.meta)
        )
        .exec()
    
    return id
}

export async function status(queue: string, id: string) {
    let item = await load(queue, id)
    
    if (!item) {
        return null
    }

    return item
}

export async function processNext(
    queue: string,
    func: (item: Item) => Promise<boolean>
) {
    let success: boolean = false
    let timestamp = new Date().getTime()
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

export async function processOne(
    queue: string,
    id: string,
    func: (item: any) => Promise<boolean>
) {
    let success: boolean = false
    let timestamp = new Date().getTime()
    let result = await Connection.client
        .eval(
            LuaCommands.getOne(),
            4,
            `queue:test`,
            `processing:test`,
            timestamp + '',
            id
        )
        
    if (result) {
        success = await runTask(queue, result, func)
    }
    
    return success
}

export async function reQueue(queue: string, minAge: number) {
    let timestamp = new Date().getTime()
    let cutoffTimestamp = timestamp - (minAge * 1000)
    let result = await Connection.client
        .zrangebyscore(`processing:${queue}`, '-inf', cutoffTimestamp)

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

export async function retry(queue: string, id: string) {
    let timestamp = new Date().getTime()
    
    await Connection.client
        .multi()
        .zrem(`error:${queue}`, id)
        .zadd(`queue:${queue}`, timestamp, id)
        .exec()

    return true
}

async function load(queue: string, id: string) {
    let data = await Connection.client.hgetall(`items:${queue}:${id}`)
    
    if (!data) {
        return null
    }
    
    let errors = []

    if (data.errors !== '') {
        errors = data.errors.split(/\|\|\|/)
    }
    
    let item = <Item>{
        id: data.id,
        created: parseInt(data.created),
        queue: data.queue,
        attempts: parseInt(data.attempts),
        success: Boolean(data.success),
        errors: errors,
        meta: JSON.parse(data.meta)
    }

    return item
}

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
        let completedTimestamp = new Date().getTime()
        
        if (success) {
            await Connection.client
                .multi()
                .zrem(`processing:${item.queue}`, item.id)
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
        let completedTimestamp = new Date().getTime()
        
        await Connection.client
            .multi()
            .zrem(`processing:${item.queue}`, item.id)
            .zadd(`error:${item.queue}`, completedTimestamp, item.id)
            .hset(
                `data:${item.queue}:${item.id}`,
                'error',
                JSON.stringify(item.errors.push(err.message))
            )
            .exec()
    }
    
    return false
}
