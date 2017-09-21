
export function getNext() {
    return `
        local result = redis.call('zrange', KEYS[1], 0, 0)
        local id = result[1]

        if id ~= nil then
            redis.call('zrem', KEYS[1], id)
            redis.call('zadd', KEYS[2], KEYS[3], id)
            return id
        else
            return nil
        end
    `
}

export function getOne() {
    return `
        local result = redis.call('zrem', KEYS[1], KEYS[4])

        if result > 0 then
            redis.call('zadd', KEYS[2], KEYS[3], KEYS[4])
            return KEYS[4]
        else
            return nil
        end
    `
}
