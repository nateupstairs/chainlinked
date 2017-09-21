const Redis = require('promise-redis')()

export var client = null

export function init(connectionString: string) {
    client = Redis.createClient(connectionString)
}
