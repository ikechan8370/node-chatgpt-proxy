const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const sse = require('koa-sse-stream');
const {getOpenAIAuth} = require("./browser/openai-auth");
const {sendRequestFull} = require('./chatgpt/proxy')

const app = new Koa();
app.use(bodyParser());
app.use(sse());
// response
app.use(async ctx => {
    let body = ctx.request.body
    let uri = ctx.path
    let headers = JSON.parse(JSON.stringify(ctx.headers))
    // Set up SSE
    ctx.response.set('Content-Type', 'text/event-stream');
    ctx.response.set('Cache-Control', 'no-cache');
    ctx.status = 200;
    ctx.body = 'Starting SSE stream...\n';
    // Send data using SSE
    await sendRequestFull(uri, ctx.method, body, headers, data => {
        ctx.sse.send(data)
    });
    console.log('end')
    // End SSE stream
    ctx.sse.sendEnd();
});
getOpenAIAuth({}).then(res => {
    console.log('first start up, fetch cloudflare token')
})
app.listen(3000);