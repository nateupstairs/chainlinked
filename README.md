# Qonvoy

> an extremely minimal task runner

> use typescript -_-

```javascript
const Qonvoy = require('qonvoy')

Qonvoy.init({
    redisConnectionString: process.env.REDIS_URL, // redis connection string
    retention: 60*60*24 // how many seconds to keep finished data
})

var firstItem = await Qonvoy.add('testqueue', {
    testing: true,
    aTestTask: 1.0
})

var secondItem = await Qonvoy.add('testqueue', {
    testing: true,
    aTestTask: 2.0
})

var thirdItem = await Qonvoy.add('testqueue', {
    testing: true,
    aTestTask: 3.0
})

async function processFunc(item: Qonvoy.Item) {
    console.log(item.aTestTask)
    return true
}

Qonvoy.processOne('testqueue', secondItem, processFunc) // specify run second item first
Qonvoy.processNext('testqueue', processFunc) // first item - next in queue
Qonvoy.processNext('testqueue', processFunc) // third item - next in queue
```
