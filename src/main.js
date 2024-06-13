const express = require('express')
const crypto = require('crypto')
const bunyan = require('bunyan');
const { ProxyAgent, fetch } = require("undici");

const { getOpenAIAuth } = require("./browser/openai-auth");
const { sendRequestFull, sendRequestNormal, getAccessToken } = require('./chatgpt/proxy')
const { ChatGPTPuppeteer } = require("./browser/full-browser");
const Config = require("./utils/config");
const { loginByUsernameAndPassword } = require("./browser/login");
const { request } = require('./utils/request')
const app = express()
const port = 3000
app.use(express.json())
global.logger = bunyan.createLogger({ name: 'node-chatgpt-proxy' });

app.post('/backend-api/conversation', async function (req, res) {
  res.set({
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  let success = false
  logger.info("request body: " + JSON.stringify(req.body))
  if (!req.body?.messages) {
    res.status(400).send({
      error: 'lack of messages'
    })
    return
  }
  sendRequestFull('/backend-api/conversation', req.method, req.body, JSON.parse(JSON.stringify(req.headers)), data => {
    if (!success && data) {
      success = true
      res.set('Content-Type', 'text/event-stream');
      res.write('Starting SSE stream...\n');
      res.flushHeaders()
    }
    logger.debug(data)
    res.write(`data: ${data}\n\n`)
    if (data === '[DONE]') {
      res.end()
    }
  }).then(result => {
    if (result?.error) {
      res.status(result.error.statusCode || 400)
      res.send(result)
      res.end();
    }
  }).catch(err => {
    logger.info(err)
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
  logger.info("request body: " + JSON.stringify(req.body))
  if (!req.body?.messages) {
    res.status(400).send({
      error: 'lack of messages'
    })
    return
  }
  const messages = req.body.messages
  const userModel = req.body.model
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
    "model": userModel,
    "timezone_offset_min": -480,
    "suggestions": [],
    "history_and_training_disabled": false,
    "conversation_mode": {
      "kind": "primary_assistant"
    },
    "force_paragen": false,
    "force_paragen_model_slug": "",
    "force_nulligen": false,
    // force_use_sse: true,
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
  let done = false
  if (stream) {
    sendRequestFull('/backend-api/conversation', req.method, body, JSON.parse(JSON.stringify(req.headers)), data => {
      if (!success && data) {
        success = true
        res.set('Content-Type', 'text/event-stream');
        res.write('Starting SSE stream...\n');
        res.flushHeaders()
      }
      // logger.info(data)
      if (data === '[DONE]') {
        res.write('data: [DONE]\n\n')
        res.end()
        done = true
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
      } else if (!done) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }).catch(err => {
      logger.info(err)
      res.send(err)
      res.status(err.statusCode || 500).end();
    })
  } else {
    let p = new Promise(async (resolve, reject) => {
      let current = ''
      await sendRequestFull('/backend-api/conversation', req.method, body, JSON.parse(JSON.stringify(req.headers)), data => {
        // logger.info(data)
        if (data === '[DONE]') {
          resolve(current)
        } else {
          try {
            const partial = JSON.parse(data)
            if (!model && partial?.message?.metadata?.model_slug) {
              model = partial?.message?.metadata?.model_slug
            }
            let role = partial?.message?.author?.role
            if (role === 'assistant') {
              let content = partial.message?.content?.parts[0]
              if (content.length > current.length) {
                current = partial.message?.content?.parts[0]
                logger.info({role, current})
              }
            }
          } catch (e) {
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
    logger.info(result)
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
  logger.info({message_id, conversation_id, voice, format})
  let token = req.headers['authorization'] ? req.headers['authorization'].split(" ")[1] : undefined
  let cookies = await cgp.getCookies()
  let cookie = ''
  for (let c of cookies) {
    cookie += `${c.name}=${c.value}; `
  }
  let {accessToken} = await getAccessToken(token)
  try {
    let voiceRsp = await request('get', `https://chatgpt.com/backend-api/synthesize?message_id=${message_id}&conversation_id=${conversation_id}&voice=${voice}&format=${format}`, undefined, {
      Authorization: `Bearer ${accessToken}`
    })
    if (voiceRsp.status !== 200) {
      res.status(voiceRsp.status).send(voiceRsp.body)
      return
    }
    res.header('Content-Type', voiceRsp.headers['Content-Type'])
    let buffer = Buffer.from(voiceRsp.body, 'base64')
    res.send(buffer)
  } catch (err) {
    logger.info(err)
    res.status(500).send(err.toString())
  }
})

app.get('/login', async (req, res) => {
  const username = req.query.username
  const password = req.query.password
  const proxy = req.query.proxy
  logger.info('login request: ' + username)
  if (!username || !password) {
    res.status(400).send({
      error: 'username or password is empty'
    })
    return
  }
  await loginByUsernameAndPassword(username, password, proxy).then(async token => {
    if (token) {
      try {
        let {accessToken, expires} = await getAccessToken(token)
        res.send({
          nextToken: token,
          username,
          accessToken,
          expires
        })
      } catch (err) {
        logger.error(err)
        res.send({
          nextToken: token,
          username,
          accessToken: null,
          expires: -1
        })
      }
    } else {
      res.status(500).send({
        error: 'login failed'
      })
    }
  }).catch(err => {
    logger.info(err)
    res.status(500).send({
      error: err.message || 'login failed'
    })
  })
})
app.get("/headers", async (req, res) => {
  try {
    let headers = await cgp.getGetTokenHeaders()
    res.send(headers)
  } catch (err) {
    res.status(500)
        .send({
          error: err.message
        })
  }
})

app.get('/tls-fingerprint', async (req, res) => {
  let fingerprint = await cgp.getJa3()
  res.send(fingerprint || {})
})

app.all("/*", async (req, res) => {
  let body = req.body
  let uri = req.url
  let response = await sendRequestNormal(uri, req.method, body, req.headers)
  // res.set('Content-Type', 'application/json');
  res.status(response?.status || 500)
  if (response?.headers) {
    Object.keys(response.headers).forEach(key => {
      if (key === 'content-encoding') {
        // no compression
        return
      }
      if (key.toLowerCase() === 'location') {
        let location = response.headers[key]
        location = location.replace('https://chatgpt.com', '')
        res.set(key, location)
        return
      }
      // todo Set-Cookie
      res.set(key, response.headers[key])
    })
  }
  res.send(response?.body || response)
})


global.lock = 0;
global.processingCount = 0;
global.CFStatus = false
global.init = false
global.cgp = new ChatGPTPuppeteer()
global.cgp.init().then(() => {
  getOpenAIAuth({}).then(() => {
    logger.info('first start up, fetch cloudflare token')
    global.CFStatus = true
    global.init = true
  })
})
setInterval(async () => {
  if (init) {
    try {
      let response = await request('get', 'https://chatgpt.com/backend-api/sentinel/chat-requirements')
      if (response.status === 403) {
        global.CFStatus = false
      }
    } catch (e) {
      logger.error(e)
    }
  }
  if (init && !CFStatus) {
    global.init = false
    try {
      logger.info('need refresh, fetching cloudflare token')
      getOpenAIAuth({}).then(res => {
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
}, 15 * 60 * 1000)

app.listen(port, () => {
  logger.info(`node-chatgpt-proxy listening on port ${port}`)
});
