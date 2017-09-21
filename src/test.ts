require('dotenv').config()

const assert = require('assert')
const tape = require('tape')

import * as Qonvoy from './qonvoy'

Qonvoy.init({
    redisConnectionString: process.env.REDIS_URL
})

async function runTests() {
    let id: string = null

    await tape.test('add', async (t) => {
        t.plan(1)
        
        id = await Qonvoy.add('test', {
            testing: true
        })
        
        t.equal(typeof id, 'string')
    })
    
    await tape.test('status', async (t) => {
        t.plan(1)
        
        let result = await Qonvoy.status('test', id)
        
        t.equal(id, result.id)
    })

    await tape.test('process next', async (t) => {
        t.plan(1)
        
        let result = await Qonvoy.processOne(
            'test',
            id,
            async (item: Qonvoy.Item) => {
                t.equal(id, item.id)
                return true
            }
        )
        
    })
    
}

runTests()
