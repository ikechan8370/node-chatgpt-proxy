const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const sse = require('koa-sse-stream');
const {getOpenAIAuth} = require("./browser/openai-auth");
const {sendRequestFull, sendRequestNormal} = require('./chatgpt/proxy')
const delay = require("delay");
const {ChatGPTPuppeteer} = require("./browser/full-browser");
const {next} = require("lodash/seq");

const app = new Koa();
app.use(bodyParser());
app.use(async (ctx, next) => {

    let body = ctx.request.body
    let uri = ctx.path
    let headers = JSON.parse(JSON.stringify(ctx.headers))
    ctx.response.set('Cache-Control', 'no-cache');
    ctx.status = 200;
    console.log('request: ' + uri)
    if (uri === '/backend-api/conversation') {
        await next()
    } else {
        let newHeaders = {
            'content-type': 'application/json',
            'x-openai-assistant-app-id': '',
            "accept": "application/json",
            'authorization': headers['authorization']
        }
        let res = await sendRequestNormal(uri, ctx.method, body, newHeaders)
        ctx.response.set('Content-Type', 'application/json');
        ctx.status = res.status
        ctx.response.body = res
    }
})
app.use(sse());
const timeout = 300000
// response
app.use(async ctx => {
    let body = ctx.request.body
    let uri = ctx.path
    // let headers = JSON.parse(JSON.stringify(ctx.headers))
    ctx.response.set('Cache-Control', 'no-cache');
    ctx.status = 200;
    // console.log(headers['authorization'])
    if (uri === '/backend-api/conversation') {
        // Set up SSE
        ctx.response.set('Content-Type', 'text/event-stream');
        ctx.body = 'Starting SSE stream...\n';
        setTimeout(() => {
            ctx.sse.sendEnd();
        }, timeout)
        // Send data using SSE
        await sendRequestFull(uri, ctx.method, body, ctx.headers, data => {
            ctx.sse.send(data)
        });
        console.log(uri + ' end')
        // End SSE stream
        ctx.sse.sendEnd();
    }
});
global.lock = 0;
global.processingCount = 0;
global.CFStatus = false
global.init = false
global.cgp = new ChatGPTPuppeteer()
global.cgp.init().then(res => {
    getOpenAIAuth({}).then(res => {
        console.log('first start up, fetch cloudflare token')
        global.CFStatus = true
        global.init = true
    })
})
setInterval(async () => {
    // console.log({lock, processingCount})
    if (global.init && !global.CFStatus) {
        global.init = false
        getOpenAIAuth({}).then(res => {
            console.log('need refresh, fetch cloudflare token')
            global.CFStatus = true
            global.init = true
        })
    }
}, 500)
app.listen(3000);