const express = require('express')
const app = express()
const port = 3000

const crypto = require('crypto')
const {getOpenAIAuth} = require("./browser/openai-auth");
const {sendRequestFull, sendRequestNormal, getAccessToken} = require('./chatgpt/proxy')
// const delay = require("delay");
const {ChatGPTPuppeteer} = require("./browser/full-browser");
const Config = require("./utils/config");
const {ProxyAgent, fetch} = require("undici");
app.use(express.json())

app.post('/backend-api/conversation', async function (req, res) {
  res.set({
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  let success = false
  console.log("request body: " + JSON.stringify(req.body))
  sendRequestFull('/backend-api/conversation', req.method, req.body, JSON.parse(JSON.stringify(req.headers)), data => {
    if (!success && data) {
      success = true
      res.set('Content-Type', 'text/event-stream');
      res.write('Starting SSE stream...\n');
      res.flushHeaders()
    }
    console.log(data)
    res.write(`data: ${data}\n\n`)
    if (data === '[DONE]') {
      res.end()
    }
  }).then(result => {
    // clearInterval(heartbeat)
    // heartbeat = null
    if (result?.error) {
      res.status(result.error.statusCode || 400)
      res.send(result)
      res.end();
    }
  }).catch(err => {
    console.log(err)
    res.status(err.statusCode || 500)
    res.send(err)
    res.end();
  })
})


app.post('/v1/chat/completions', async function (req, res) {
  res.set({
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  let success = false
  console.log("request body: " + JSON.stringify(req.body))

  const messages = req.body.messages
  const prompt = JSON.stringify(messages)
  const messageId = crypto.randomUUID()
  const parentMessageId = crypto.randomUUID()
  const body = {
    "action": "next",
    "messages": [
      {
        "id": messageId,
        "author": {
          "role": "user"
        },
        "content": {
          "content_type": "text",
          "parts": [
            prompt
          ]
        }
      }
    ],
    "parent_message_id": parentMessageId,
    "model": "auto",
    "timezone_offset_min": -480,
    "suggestions": [
      "把我当做五岁小朋友一样，向我解释超导体。",
      "为 TikTok 帐户创建一个用于评估房地产楼盘的内容日历。",
      "你能帮我设计一个用于教授基础编程技能的游戏概念吗？先询问我希望使用哪种编程语言。",
      "你能帮我规划一个专门用于恢复活力的放松日吗？首先，你能问我最喜欢的放松方式是什么吗？"
    ],
    "history_and_training_disabled": false,
    "conversation_mode": {
      "kind": "primary_assistant"
    },
    "force_paragen": false,
    "force_paragen_model_slug": "",
    "force_nulligen": false,
    "force_rate_limit": false,
    "reset_rate_limits": false,
  }

  function generateRandomId() {
    return Math.floor((1 + Math.random()) * 0x100000000)
        .toString(16)
        .substring(1);
  }

  // generate random id like 1579e68f
  const id = generateRandomId()
  let model = ''
  let current = ''
  let stream = req.body.stream || false
  if (stream) {
    sendRequestFull('/backend-api/conversation', req.method, body, JSON.parse(JSON.stringify(req.headers)), data => {
      if (!success && data) {
        success = true
        res.set('Content-Type', 'text/event-stream');
        res.write('Starting SSE stream...\n');
        res.flushHeaders()
      }

      if (data === '[DONE]') {
        res.write('data: [DONE]')
        res.end()
      } else {
        const partial = JSON.parse(data)
        if (!model && partial?.message?.metadata?.model_slug) {
          model = partial?.message?.metadata?.model_slug
        }
        let role = partial?.message?.author?.role
        if (role === 'assistant') {
          let parts = partial.message?.content?.parts[0]
          if (parts.length > current.length) {
            const delta = current ? parts.replace(current, '') : parts
            current = parts
            if (delta) {
              const openaiBody = {
                "id": "cmpl-" + id,
                "object": "chat.completion.chunk",
                "created": new Date().getTime(),
                "model": model,
                "choices": [
                  {
                    "delta": {
                      "content": delta
                    },
                    "index": 0,
                    "finish_reason": "stop"
                  }
                ],
                "content": parts,
                "usage": {
                  "completion_tokens": 8,
                  "prompt_tokens": 8,
                  "total_tokens": 16
                }
              }
              res.write(`data: ${JSON.stringify(openaiBody)}\n\n`)
            }
          }
        }
      }
    }).then(result => {
      if (result?.error) {
        res.send(result)
        res.status(result.error.statusCode).end();
      }
    }).catch(err => {
      console.log(err)
      res.send(err)
      res.status(err.statusCode || 500).end();
    })
  } else {
    let p = new Promise(async (resolve, reject) => {
      let current = ''
      await sendRequestFull('/backend-api/conversation', req.method, body, JSON.parse(JSON.stringify(req.headers)), data => {
        // console.log(data)
        if (data === '[DONE]') {
          resolve(current)
        } else {
          const partial = JSON.parse(data)
          if (!model && partial?.message?.metadata?.model_slug) {
            model = partial?.message?.metadata?.model_slug
          }
          let role = partial?.message?.author?.role
          if (role === 'assistant') {
            let content = partial.message?.content?.parts[0]
            if (content.length > current.length) {
              current = partial.message?.content?.parts[0]
              console.log({role, current})
            }
          }
        }
      })
    })
    let response = await p
    let result = {
      "id": "cmpl-" + id,
      "object": "chat.completion",
      "created": new Date().getTime(),
      "model": model,
      "usage": {
        "completion_tokens": 80,
        "prompt_tokens": 15,
        "total_tokens": 95
      },
      "choices": [
        {
          "index": 0,
          "message": {
            "role": "assistant",
            "content": response
          },
          "finish_reason": "stop"
        }
      ]
    }
    console.log(result)
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(result))
    res.end()
  }
})

app.get("/backend-api/synthesize", async (req, res) => {
  const message_id = req.query.message_id
  const conversation_id = req.query.conversation_id
  const voice = req.query.voice || "cove"
  const format = req.query.format || "mp3"
  console.log({message_id, conversation_id, voice, format})
  let token = req.headers['authorization'] ? req.headers['authorization'].split(" ")[1] : undefined
  let cookies = await global.cgp.getCookies()
  let cookie = ''
  for (let c of cookies) {
    cookie += `${c.name}=${c.value}; `
  }
  let accessToken = await getAccessToken(token)
  let ua = await global.cgp.getUa()
  let option = {
    method: "GET",
    headers: {
      Cookie: cookie,
      'User-Agent': ua,
      Referer: 'https://chatgpt.com/',
      "Sec-Ch-Ua":'"Chromium";v="124", "Google Chrome";v="124", ";Not A Brand";v="99"',
      "Sec-Ch-Ua-Mobile":"?0",
      "Sec-Ch-Ua-Platform":'"Windows"',
      "Sec-Fetch-Dest":"document",
      "Sec-Fetch-Mode":"navigate",
      "Sec-Fetch-Site":"cross-site",
      "Sec-Fetch-User":"?1",
      "Upgrade-Insecure-Requests":"1",
      // "Accept-Encoding":"gzip, deflate, br, zstd",
      "Accept-Language":"en-US,en;q=0.9",
      "Cache-Control":"max-age=0",
      Authorization: `Bearer ${accessToken}`
    }
  }
  let proxy = Config.proxy
  if (proxy) {
    const agent = new ProxyAgent(proxy)
    option.dispatcher = agent
  }
  try {
    let voiceRsp = await fetch(`https://chatgpt.com/backend-api/synthesize?message_id=${message_id}&conversation_id=${conversation_id}&voice=${voice}&format=${format}`, option)
    if (voiceRsp.status !== 200) {
      res.status(voiceRsp.status).send(await voiceRsp.text())
      return
    }
    let voiceBuffer = await voiceRsp.arrayBuffer()
    res.header('Content-Type', voiceRsp.headers.get('content-type'))
    res.send(Buffer.from(voiceBuffer))
  } catch (err) {
    console.log(err)
    res.status(500).send(err.toString())
  }
})
app.all("/*", async (req, res) => {
  let body = req.body
  let uri = req.path
  let headers = JSON.parse(JSON.stringify(req.headers))
  res.set('Cache-Control', 'no-cache');
  console.log('request: ' + uri)
  let newHeaders = {
    'content-type': 'application/json',
    'x-openai-assistant-app-id': '',
    "accept": "application/json",
    'authorization': headers['authorization']
  }
  let response = await sendRequestNormal(uri, req.method, body, newHeaders)
  // res.set('Content-Type', 'application/json');
  res.status(response.status)
  res.send(response)
})
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
    try {
      getOpenAIAuth({}).then(res => {
        console.log('need refresh, fetch cloudflare token')
        global.CFStatus = true
        global.init = true
      }).catch(err => {
        console.warn(err)
        global.init = true
      })
    } catch (err) {
      console.warn(err)
      global.init = true
    }

  }
}, 500)
app.listen(port, () => {
  console.log(`node-chatgpt-proxy listening on port ${port}`)
});
