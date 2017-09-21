require('dotenv').config()

const assert = require('assert')
const tape = require('tape')

import * as Chainlinked from './chainlinked'

Chainlinked.init({
    redisConnectionString: process.env.REDIS_URL
})


async function runTests() {
    let id: string = null

    await tape.test('add', async (t) => {
        t.plan(1)
        
        id = await Chainlinked.add('test', {
            testing: true
        })
        
        t.equal(typeof id, 'string')
    })
    
    await tape.test('status', async (t) => {
        t.plan(1)
        
        let result = await Chainlinked.status('test', id)
        
        t.equal(id, result.id)
    })

    await tape.test('process next', async (t) => {
        t.plan(1)
        
        let result = await Chainlinked.processOne(
            'test',
            id,
            async (item: Chainlinked.Item) => {
                t.equal(id, item.id)
                return true
            }
        )
        
    })
    
}

runTests()
