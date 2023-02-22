const {createParser} = require('eventsource-parser')

async function fetchSSE(
    url,
    options
) {
    const res = await fetch(url, options)
    if (!res.ok) {
        const msg = `ChatGPT error ${res.status || res.statusText}`
        const error = new Error(msg)
        error.statusCode = res.status
        error.statusText = res.statusText
        throw error
    }

    const parser = createParser((event) => {
        if (event.type === 'event') {
            console.log(event.data)
        }
    })

    if (!res.body.getReader) {
        // Vercel polyfills `fetch` with `node-fetch`, which doesn't conform to
        // web standards, so this is a workaround...
        const body = res.body

        if (!body.on || !body.read) {
            throw new Error('unsupported "fetch" implementation')
        }

        body.on('readable', () => {
            let chunk
            while (null !== (chunk = body.read())) {
                parser.feed(chunk.toString())
            }
        })
    } else {
        for await (const chunk of streamAsyncIterable(res.body)) {
            const str = new TextDecoder().decode(chunk)
            parser.feed(str)
        }
    }
}

async function* streamAsyncIterable(stream) {
    const reader = stream.getReader()
    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) {
                return
            }
            yield value
        }
    } finally {
        reader.releaseLock()
    }
}

module.exports = { fetchSSE }