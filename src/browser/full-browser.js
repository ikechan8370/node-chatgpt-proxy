const lodash = require('lodash');
const {sha3_512} = require('js-sha3');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Config = require('../utils/config')
const delay = require('delay')
const {v4: uuidv4} = require('uuid')
const {acquireLockAndPlus, acquireLockAndMinus} = require("../utils/lock");
const {resolve} = require("path");
const {readFileSync} = require("fs");
const {RequestInterceptionManager} = require("puppeteer-intercept-and-modify-requests");
const chatUrl = 'https://chatgpt.com/'
let puppeteer = {}

class Puppeteer {
  constructor() {
    let args = [
      '--exclude-switches',
      '--no-sandbox',
      '--remote-debugging-port=51777',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--no-first-run',
      '--no-service-autorun',
      '--password-store=basic',
      '--system-developer-mode',
      '--mute-audio',
      '--disable-default-apps',
      '--no-zygote',
      '--disable-accelerated-2d-canvas',
      '--disable-web-security',
      '--window-size=800,600'

      // '--shm-size=1gb'
    ]
    if (Config.proxy) {
      args.push(`--proxy-server=${Config.proxy}`)
    }
    if (process.env.DISPLAY) {
      args.push(`--display=${process.env.DISPLAY}`)
    }
    this.browser = null
    this.lock = false
    this.config = {
      headless: false,
      args
    }

    if (Config.chromePath) {
      this.config.executablePath = Config.chromePath
    }

    this.html = {}
  }

  async initPupp() {
    if (!lodash.isEmpty(puppeteer)) return puppeteer
    puppeteer = (await import('puppeteer-extra')).default
    const pluginStealth = StealthPlugin()
    puppeteer.use(pluginStealth)
    return puppeteer
  }

  async disconnectBrowser() {
    await this.browser.disconnect()
    this.browser = null
  }

  /**
   * 初始化chromium
   */
  async browserInit() {
    await this.initPupp()
    if (this.browser) return this.browser
    if (this.lock) return false
    this.lock = true

    console.log('chatgpt puppeteer 启动中...')
    const browserURL = 'http://127.0.0.1:51777'
    try {
      this.browser = await puppeteer.connect({browserURL})
    } catch (e) {
      /** 初始化puppeteer */
      this.browser = await puppeteer.launch(this.config).catch((err) => {
        console.error(err.toString())
        if (String(err).includes('correct Chromium')) {
          console.error('没有正确安装Chromium，可以尝试执行安装命令：node ./node_modules/puppeteer/install.js')
        }
      })
    }
    this.lock = false

    if (!this.browser) {
      console.error('chatgpt puppeteer 启动失败')
      return false
    }

    console.log('chatgpt puppeteer 启动成功')

    /** 监听Chromium实例是否断开 */
    this.browser.on('disconnected', (e) => {
      // console.info('Chromium实例关闭或崩溃！')
      this.browser = false
    })

    return this.browser
  }
}

class ChatGPTPuppeteer extends Puppeteer {
  constructor(opts = {}) {
    super()
    const {
      email,
      password,
      markdown = true,
      debug = false,
      isGoogleLogin = false,
      minimize = false,
      captchaToken,
      executablePath
    } = opts

    this._email = email
    this._password = password

    this._markdown = !!markdown
    this._debug = !!debug
    this._isGoogleLogin = !!isGoogleLogin
    this._minimize = !!minimize
    this._captchaToken = captchaToken
    this._executablePath = executablePath
  }

  async getBrowser() {
    if (this.browser) {
      return this.browser
    } else {
      return await this.browserInit()
    }
  }

  async init(first = true) {
    // if (this.inited) {
    //   return true
    // }
    console.info('init chatgpt browser')
    try {
      // this.browser = await getBrowser({
      //   captchaToken: this._captchaToken,
      //   executablePath: this._executablePath
      // })
      this.browser = await this.getBrowser()
      this._page =
          (await this.browser.pages())[0] || (await this.browser.newPage())
      await maximizePage(this._page)
      if (first) {
        await this._page.setCacheEnabled(false)
        // await this._page.setRequestInterception(true);
        // this._page.on('request', this._onRequest.bind(this))
        // this._page.on('response', this._onResponse.bind(this))
      }
      await this._page.deleteCookie({
        name: '__Secure-next-auth.session-token',
        domain: '.chatgpt.com'
      })
      await this._page.goto(chatUrl, {
        waitUntil: 'networkidle2'
      })

      let timeout = 30000
      try {
        while (timeout > 0 && (await this._page.title()).toLowerCase().indexOf('moment') > -1) {
          // if meet captcha
          await delay(300)
          timeout = timeout - 300
        }
      } catch (e) {
        // navigation后获取title会报错，报错说明已经在navigation了正合我意。
      }
      if (timeout < 0) {
        console.error('wait for cloudflare navigation timeout. 可能遇见验证码')
        throw new Error('wait for cloudflare navigation timeout. 可能遇见验证码')
      }
      try {
        await this._page.waitForNavigation({timeout: 3000})
      } catch (e) {
      }

      await this._page.evaluate(() => {
        // Here you can inline the library code or load it from a CDN
        // For simplicity, let's load it from a CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.8.0/sha3.min.js';
        document.head.appendChild(script);
      });

    } catch (err) {
      if (this.browser) {
        await this.browser.close()
      }

      this.browser = null
      this._page = null

      throw err
    }

    if (this._minimize) {
      await minimizePage(this._page)
    }

    this.getJa3().then(fingerprint => {
      console.log('ja3 fingerprint got: ' + fingerprint?.ja3)
    })

    return true
  }

  _onResponse = async (response) => {

  }

  // we cannot modify cookie header through interception
  // https://stackoverflow.com/questions/61745074/puppeteer-set-request-cookie-header
  _onRequest = (request) => {
    // const headers = request.headers();
    // if (headers['cookie-pre']) {
    //   let newHeaders = Object.assign({}, headers, {
    //     Cookie: headers['cookie-pre'],
    //     'cookie-pre': undefined
    //   })
    //   request.continue({ headers: newHeaders });
    // } else {
    //   // console.log(request.url())
    //   request.continue()
    // }
  }

  setCfStatus(status) {
    global.CFStatus = status
  }

  async sendRequest(
      url, method, body, newHeaders = {}, cookie = {}
  ) {
    for (let ckKey of Object.keys(cookie)) {
        await this._page.setCookie({
            name: ckKey,
            value: cookie[ckKey],
            domain: '.chatgpt.com',
            secure: true
        })
    }
    const result = await this._page.evaluate(
        browserNormalFetch,
        url,
        newHeaders,
        body,
        method
    )
    console.log('<<< EVALUATE', result)
    for (let ckKey of Object.keys(cookie)) {
      await this._page.deleteCookie({
        name: ckKey,
        domain: '.chatgpt.com'
      })
    }
    return result
  }

  async cleanNextToken() {
    let key = '__Secure-next-auth.session-token'
    await this._page.setCookie({
      name: key,
      value: '',
      domain: 'chatgpt.com',
      path: '/',
      expires: -1,
      httpOnly: true,
    })
  }

  async getUa() {
    return await this.browser.userAgent()
  }

  async getCookies() {
    return await this._page.cookies()
  }

  async getGetTokenHeaders() {
    let page = await this.browser.newPage()
    let headers
    const {RequestInterceptionManager} = require('puppeteer-intercept-and-modify-requests')
    const client = await page.target().createCDPSession()
    await client.send('Network.enable')
    await client.send('Page.enable');
    const interceptManager = new RequestInterceptionManager(client)
    await interceptManager.intercept(
        {
          urlPattern: `*`,
          // specify how you want to modify the response (may be async):
          modifyRequest: ({event}) => {
            // console.log(event)
            // console.log(event.request.url)
            if (event.request.url.endsWith('/api/auth/session')) {
              console.log('intercept')
              headers = event.request.headers
            }
          },
        }
    )
    await page.goto('https://chatgpt.com/api/auth/session', {
      waitUntil: 'networkidle0'
    })
    await page.close()
    return headers
  }

  async getToken(nextToken) {
    // todo mutex lock
    let page = this._page
    try {
      await page.deleteCookie({
        name: '__Secure-next-auth.session-token',
        domain: '.chatgpt.com',
      })
      // await page.setCacheEnabled(false)
      await page.setCookie({
        name: '__Secure-next-auth.session-token',
        value: nextToken,
        domain: '.chatgpt.com',
        secure: true
      })
      // await page.goto('https://chatgpt.com/api/auth/session', {
      //   waitUntil: 'networkidle0'
      // })
      let session = await page.evaluate(() => {
        return fetch("https://chatgpt.com/api/auth/session", {
          method: 'GET'
        }).then(res => res.json())
      })
      return session
    } catch (e) {
      console.error(e)
    } finally {
      this._page.deleteCookie({
        name: '__Secure-next-auth.session-token',
        domain: '.chatgpt.com'
      })
      // await page.close()
    }
  }

  async getJa3() {
    if (this.fingerprint) {
      return this.fingerprint
    }
    let page = await this.browser.newPage()
    try {
      await page.goto('https://scrapfly.io/web-scraping-tools/ja3-fingerprint', {
        waitUntil: 'networkidle2'
      })
      let fingerprint = await page.evaluate(() => {
        return window.fingerprint
      })
      this.fingerprint = fingerprint
      return fingerprint
    } catch (err) {
      console.error(err)
      return null
    } finally {
      await page.close()
    }
  }

  async sendMessage(
      message,
      accessToken,
      // authToken,
      opts = {}
  ) {

    const {
      conversationId,
      parentMessageId = uuidv4(),
      messageId = uuidv4(),
      action = 'next',
      // TODO
      timeoutMs,
      model = 'auto',
      // onProgress,
      onConversationResponse
    } = opts
    let url = 'https://chatgpt.com/backend-api/conversation'
    if (!accessToken) {
      url = 'https://chatgpt.com/backend-anon/conversation'
    }

    const body = {
      action,
      messages: [
        {
          id: messageId,
          content: {
            content_type: 'text',
            parts: [message]
          },
          author: {
            role: 'user'
          }
        }
      ],
      model,
      parent_message_id: parentMessageId,
      "timezone_offset_min": -480,
      "history_and_training_disabled": false,
      "conversation_mode": {
        "kind": "primary_assistant"
      },
      suggestions: [],
      "force_paragen": false,
      "force_paragen_model_slug": "",
      "force_nulligen": false,
      "force_rate_limit": false,
      "reset_rate_limits": false,
      force_use_sse: true
    }

    if (conversationId) {
      body.conversation_id = conversationId
    }

    async function addPageBinding(page, name, callback) {
      try {
        await page.exposeFunction(name, callback);
      } catch (error) {
        console.debug(`Failed to add page binding with name ${name}: ${error.message}`);
      }
    }

    let id = uuidv4().replaceAll("-", "")
    // console.log('>>> EVALUATE', url, this._accessToken, body)
    // console.log("function name: " + `backStreamToNode${id}`)
    await addPageBinding(this._page, `backStreamToNode${id}`, (data) => {
      onConversationResponse(data)
      // console.log(data)
    });
    acquireLockAndPlus()
    let result
    // const t = async () => await this._page.evaluate(() => {
    //   return performance.now()
    // })
    // const actionMap = {
    //   focusin: 0,
    //   focusout: 1,
    //   copy: 2,
    //   paste: 3,
    //   touchstart: 4,
    //   touchend: 5
    // }
    // 0,115606,1,115612,0,234031,1,235657,0,235794
    // let s = []
    //
    // async function i(e) {
    //   s.push({
    //     type: e,
    //     ts: Math.round(await t())
    //   })
    // }
    // await i(actionMap.focusin)
    // await i(actionMap.focusout)
    // await i(actionMap.focusin)
    // await i(actionMap.focusout)
    // await i(actionMap.focusin)
    // let oaiLogs = s.slice(0, 10).map(e=>"".concat(e.type, ",").concat(e.ts)).join(",")
    const sha3LibPath = resolve(__dirname, 'sha3.min.js');
    const sha3LibCode = readFileSync(sha3LibPath, 'utf8');
    await this._page.evaluate(sha3LibCode);
    let requirementSeed = Math.random() + ""
    let requirementToken = "gAAAAAC" + await this._page.evaluate(getPow, requirementSeed, "0")
    let newHeaders = {
      Authorization: `Bearer ${accessToken}`
    }
    if (!accessToken) {
      delete newHeaders.Authorization
    }
    let proofRsp = await this.sendRequest(`https://chatgpt.com/backend-${accessToken ? 'api' : 'anon'}/sentinel/chat-requirements`, "POST", {
      p: requirementToken
    }, newHeaders)
    if (proofRsp.error) {
      return proofRsp
    }
    let proofRspJsonStr = proofRsp.body
    let proof = JSON.parse(proofRspJsonStr)
    let token = proof.token
    // console.log({proof, token})
    let cookies = await this._page.cookies()

    function getCookieByName(cookies, name) {
      return cookies.find(cookie => cookie.name === name);
    }

    const cookie = getCookieByName(cookies, 'oai-did');
    this.deviceId = cookie.value
    let pow = "gAAAAAB" + await this._page.evaluate(getPow, proof.proofofwork.seed, proof.proofofwork.difficulty)
    // console.log({pow})
    result = await this._page.evaluate(
        browserPostEventStream,
        url,
        // authToken,
        accessToken,
        body,
        timeoutMs,
        id,
        this.deviceId,
        token,
        pow,
        // oaiLogs
    )
    if (result.conversationResponse) {
      console.log(result.response)
    } else {
      console.log('<<< EVALUATE', result)
    }
    if (result?.error?.statusCode === 403) {
      global.CFStatus = false
      acquireLockAndMinus()
      console.log("cf token expired, wait for refreshing")
      while (!global.CFStatus) {
        await delay(500)
      }

      let pow = "gAAAAAB" + await this._page.evaluate(getPow, proof.proofofwork.seed, proof.proofofwork.difficulty)
      // console.log({proof})
      result = await this._page.evaluate(
          browserPostEventStream,
          url,
          accessToken,
          body,
          timeoutMs,
          id,
          this.deviceId,
          token,
          pow,
          // oaiLogs
      )
    }
    acquireLockAndMinus()
    if (result.error) {
      return {
        error: result.error
      }
      // console.error(result.error)
      // const error = new Error(result.error.message)
      // error.statusCode = result.error.statusCode
      // error.statusText = result.error.statusText
      //
      // throw error
    }

    // TODO: support sending partial response events
    if (onConversationResponse) {
      onConversationResponse(result.conversationResponse)
    }
    // this._page._pageBindings.set(`backStreamToNode${id}`, function(){});
    this._page._pageBindings?.delete(`backStreamToNode${id}`)

    return {
      text: result.response,
      conversationId: result.conversationResponse.conversation_id,
      id: messageId,
      parentMessageId
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
    }
    this._page = null
    this.browser = null
  }

  protected

  async _getInputBox() {
    // [data-id="root"]
    return this._page?.$('textarea')
  }
}

async function minimizePage(page) {
  const session = await page.target().createCDPSession()
  const goods = await session.send('Browser.getWindowForTarget')
  const {windowId} = goods
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: {windowState: 'minimized'}
  })
}

async function maximizePage(page) {
  const session = await page.target().createCDPSession()
  const goods = await session.send('Browser.getWindowForTarget')
  const {windowId} = goods
  await session.send('Browser.setWindowBounds', {
    windowId,
    bounds: {windowState: 'normal'}
  })
}

function isRelevantRequest(url) {
  let pathname

  try {
    const parsedUrl = new URL(url)
    pathname = parsedUrl.pathname
    url = parsedUrl.toString()
  } catch (_) {
    return false
  }

  if (!url.startsWith('https://chatgpt.com')) {
    return false
  }

  if (
      !pathname.startsWith('/backend-api/') &&
      !pathname.startsWith('/api/auth/session')
  ) {
    return false
  }

  if (pathname.endsWith('backend-api/moderations')) {
    return false
  }

  return true
}

async function browserRequest(
    url, accessToken, body, method, deviceId, timeoutMs
) {
  globalThis.__name = () => undefined
  let headers = {}
  if (deviceId) {
    headers['oai-device-id'] = deviceId
  }
  const res = await fetch(url, {
    method,
    body: JSON.stringify(body),
    headers
  })
  let result = {
    status: res.status,
    statusText: res.statusText,
    body: await res.json(),
  }
  return result
}

async function getPow(seed, difficulty) {
  function o(e) {
    return e[Math.floor(Math.random() * e.length)]
  }

  function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getConfig() {
    var e, t, n, r, a, i, s, l;
    return [
      // (null === (e = navigator) || void 0 === e ? void 0 : e.hardwareConcurrency) + (null === (t = screen) || void 0 === t ? void 0 : t.width) + (null === (n = screen) || void 0 === n ? void 0 : n.height),
      (null === (e = navigator) || void 0 === e ? void 0 : 16) + (null === (t = screen) || void 0 === t ? void 0 : getRandomNumber(2100, 2250)) + (null === (n = screen) || void 0 === n ? void 0 : getRandomNumber(1200, 1250)),
      "" + new Date,
      // null === (r = performance) || void 0 === r || null === (r = r.memory) || void 0 === r ? void 0 : r.jsHeapSizeLimit,
      4294705152,
      null == Math ? void 0 : Math.random(),
      // use windows UA instead to keep the difficulty value large enough
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
      // null === (a = navigator) || void 0 === a ? void 0 : a.userAgent,
      o(Array.from(document.scripts).map(e => null == e ? void 0 : e.src).filter(e => e)),
      null !== (i = (null !== (s = Array.from(document.scripts || []).map(e => {
            var t;
            return null == e || null === (t = e.src) || void 0 === t ? void 0 : t.match("dpl.*")
          }
      ).filter(e => null == e ? void 0 : e.length)[0]) && void 0 !== s ? s : [])[0]) && void 0 !== i ? i : null,
      navigator.language, null === (l = navigator.languages) || void 0 === l ? void 0 : l.join(","),
      null == Math ? void 0 : Math.random(),
      function () {
        let e = o(Object.keys(Object.getPrototypeOf(navigator)));
        try {
          return "".concat(e, "−").concat(navigator[e].toString())
        } catch {
          return "".concat(e)
        }
      }(), o(Object.keys(document)), o(Object.keys(window))]
  }

  const maxAttempts = 100000

  async function _generateAnswer(e, t) {
    let n = "e"
        , r = performance.now();
    try {
      let n = null
          , i = getConfig();
      console.log(i)
      for (let o = 0; o < maxAttempts; o++) {
        (!n || 0 >= n.timeRemaining()) && (n = await new Promise(e => {
              (window.requestIdleCallback || function (e) {
                    return setTimeout(() => {
                          e({
                            timeRemaining: () => 1,
                            didTimeout: !1
                          })
                        }
                        , 0),
                        0
                  }
              )(t => {
                    e(t)
                  }
              )
            }
        )),
            i[3] = o,
            i[9] = Math.round(performance.now() - r);
        let l = s(i);
        // console.log({l})
        let hasher = sha3_512.create()
        let hashed = hasher.update(e + l)
        hashed = hashed.hex()
        // console.log(t)
        // console.log(t.length)
        // console.log({hashed})
        if (hashed.substring(0, t.length) <= t)
          return l
      }
    } catch (e) {
      console.error(e)
      n = s("" + e)
    }
    return "wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D" + n
  }

  function s(e) {
    return (e = JSON.stringify(e),
        window.TextEncoder) ? btoa(String.fromCharCode(...new TextEncoder().encode(e))) : btoa(unescape(encodeURIComponent(e)))
  }

  // sometimes difficulty is too low, like 32 or 45, just retry 5 times
  let retry = 5
  let answer = await _generateAnswer(seed, difficulty)
  while (retry >= 0 && answer.length <= "wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D".length + 1) {
    answer = await _generateAnswer(seed, difficulty)
    retry--
  }
  return answer
}

/**
 * This function is injected into the ChatGPT webapp page using puppeteer. It
 * has to be fully self-contained, so we copied a few third-party sources and
 * included them in here.
 */
async function browserPostEventStream(
    url,
    // authToken,
    accessToken,
    body,
    timeoutMs,
    id,
    deviceId, token, proof, oaiLogs = ''
) {
  // Workaround for https://github.com/esbuild-kit/tsx/issues/113
  globalThis.__name = () => undefined

  const BOM = [239, 187, 191]

  let conversationResponse
  let conversationId = body?.conversation_id
  let messageId = body?.messages?.[0]?.id
  let response = ''

  try {
    console.log('browserPostEventStream', url, accessToken, body)

    let abortController = null
    if (timeoutMs) {
      abortController = new AbortController()
    }
    let headers = {
      accept: 'text/event-stream',
      'content-type': 'application/json',
      'oai-device-id': deviceId,
      'openai-sentinel-chat-requirements-token': token,
      'openai-sentinel-proof-token': proof,
      // 'oai-echo-logs': oaiLogs,
      'oai-language': 'en-US',
      // Cookie: `__Secure-next-auth.session-token=${authToken};`,
      dnt: '1',
      origin: 'https://chatgpt.com',
      referer: 'https://chatgpt.com/?model=gpt-4o',
      priority: 'u=1, i'
    }
    let wsUrl

    let response_id = undefined
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`
      const wsRsp = await fetch('https://chatgpt.com/backend-api/register-websocket', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'oai-device-id': deviceId,
          'oai-language': 'en-US',
          'origin': 'https://chatgpt.com',
          'referer': 'https://chatgpt.com/?model=gpt-4o',
          'priority': 'u=1, i',
          Authorization: `Bearer ${accessToken}`
        }
      })
      const wsRspJson = await wsRsp.json()
      wsUrl = wsRspJson['wss_url']
    }

    let cbfName = 'backStreamToNode' + id
    const responseP = new Promise(
        async (resolve, reject) => {
          let finish = false

          function onMessage(data) {
            window[cbfName](data)
            try {
              finish = JSON.parse(data).message?.status === 'finished_successfully'
            } catch (e) {
            }
            if (data === '[DONE]' && finish) {
              return resolve({
                error: null,
                response,
                conversationId,
                messageId,
                conversationResponse
              })
            }
            try {
              const _checkJson = JSON.parse(data)
            } catch (error) {
              console.log('warning: parse error.')
              return
            }
            try {
              const convoResponseEvent =
                  JSON.parse(data)
              conversationResponse = convoResponseEvent
              if (convoResponseEvent.conversation_id) {
                conversationId = convoResponseEvent.conversation_id
              }

              if (convoResponseEvent.message?.id) {
                messageId = convoResponseEvent.message.id
              }

              const partialResponse =
                  convoResponseEvent.message?.content?.parts?.[0]

              if (partialResponse) {
                response = partialResponse
              }
            } catch (err) {
              console.warn('fetchSSE onMessage unexpected error', err)
              reject(err)
            }
          }

          if (wsUrl) {
            let socket = new WebSocket(wsUrl)
            let finish = false
            socket.addEventListener("message", async (event) => {
              let msg = JSON.parse(event.data)
              while (!response_id) {
                // sleep for 500ms
                await new Promise(r => setTimeout(r, 500))
              }
              if (msg.conversation_id === conversationId && msg?.response_id === response_id) {
                // todo heartbeat
                let body = msg.body
                let realMsg = atob(body)
                if (realMsg.trim().length > 0) {
                  let dataMsg = realMsg.trim().replace('data: ', '')
                  try {
                    finish = JSON.parse(dataMsg).message?.status === 'finished_successfully'
                  } catch (e) {
                  }
                  onMessage(dataMsg)
                  if (finish && realMsg.trim() === 'data: [DONE]') {
                    socket.close()
                  }
                }
              }
            });
          }
          const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            signal: abortController?.signal,
            headers
          })

          console.log('browserPostEventStream response', res)

          if (!res.ok) {
            let bodyText = await res.text()
            let result
            try {
              result = JSON.parse(bodyText)
            } catch (err) {
              result = bodyText
            }

            reject(result?.detail?.message || result?.detail || result)
          }

          console.log(res.headers)
          console.log(res.headers.get('content-type'))
          if (res.headers.get('content-type').includes('application/json')) {
            console.log('use ws')
            const wsRes = await res.json()
            conversationId = wsRes.conversation_id
            response_id = wsRes.response_id
          } else {
            console.log('use sse')
            const parser = createParser((event) => {
              if (event.type === 'event') {
                onMessage(event.data)
              }
            })

            for await (const chunk of streamAsyncIterable(res.body)) {
              const str = new TextDecoder().decode(chunk)
              parser.feed(str)
            }
          }

        }
    )

    if (timeoutMs) {
      if (abortController) {
        // This will be called when a timeout occurs in order for us to forcibly
        // ensure that the underlying HTTP request is aborted.
        responseP.cancel = () => {
          abortController.abort()
        }
      }
      // console.log({ pTimeout })
      return await pTimeout(responseP, {
        milliseconds: timeoutMs,
        message: 'ChatGPT timed out waiting for response'
      })
    } else {
      return await responseP
    }
  } catch (err) {
    const errMessageL = err.toString().toLowerCase()

    if (
        response &&
        (errMessageL === 'error: typeerror: terminated' ||
            errMessageL === 'typeerror: terminated')
    ) {
      // OpenAI sometimes forcefully terminates the socket from their end before
      // the HTTP request has resolved cleanly. In my testing, these cases tend to
      // happen when OpenAI has already send the last `response`, so we can ignore
      // the `fetch` error in this case.
      return {
        error: null,
        response,
        conversationId,
        messageId,
        conversationResponse
      }
    }

    return {
      error: {
        message: err.toString(),
        statusCode: err.statusCode || err.status || err.response?.statusCode,
        statusText: err.statusText || err.response?.statusText
      },
      response: null,
      conversationId,
      messageId,
      conversationResponse
    }
  }
  //  async function pTimeout (promise, option) {
  //    return await pTimeout(promise, option)
  //  }
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

  // @see https://github.com/rexxars/eventsource-parser
  function createParser(onParse) {
    // Processing state
    let isFirstChunk
    let buffer
    let startingPosition
    let startingFieldLength

    // Event state
    let eventId
    let eventName
    let data

    reset()
    return {feed, reset}

    function reset() {
      isFirstChunk = true
      buffer = ''
      startingPosition = 0
      startingFieldLength = -1

      eventId = undefined
      eventName = undefined
      data = ''
    }

    function feed(chunk) {
      buffer = buffer ? buffer + chunk : chunk

      // Strip any UTF8 byte order mark (BOM) at the start of the stream.
      // Note that we do not strip any non - UTF8 BOM, as eventsource streams are
      // always decoded as UTF8 as per the specification.
      if (isFirstChunk && hasBom(buffer)) {
        buffer = buffer.slice(BOM.length)
      }

      isFirstChunk = false

      // Set up chunk-specific processing state
      const length = buffer.length
      let position = 0
      let discardTrailingNewline = false

      // Read the current buffer byte by byte
      while (position < length) {
        // EventSource allows for carriage return + line feed, which means we
        // need to ignore a linefeed character if the previous character was a
        // carriage return
        // @todo refactor to reduce nesting, consider checking previous byte?
        // @todo but consider multiple chunks etc
        if (discardTrailingNewline) {
          if (buffer[position] === '\n') {
            ++position
          }
          discardTrailingNewline = false
        }

        let lineLength = -1
        let fieldLength = startingFieldLength
        let character

        for (
            let index = startingPosition;
            lineLength < 0 && index < length;
            ++index
        ) {
          character = buffer[index]
          if (character === ':' && fieldLength < 0) {
            fieldLength = index - position
          } else if (character === '\r') {
            discardTrailingNewline = true
            lineLength = index - position
          } else if (character === '\n') {
            lineLength = index - position
          }
        }

        if (lineLength < 0) {
          startingPosition = length - position
          startingFieldLength = fieldLength
          break
        } else {
          startingPosition = 0
          startingFieldLength = -1
        }

        parseEventStreamLine(buffer, position, fieldLength, lineLength)

        position += lineLength + 1
      }

      if (position === length) {
        // If we consumed the entire buffer to read the event, reset the buffer
        buffer = ''
      } else if (position > 0) {
        // If there are bytes left to process, set the buffer to the unprocessed
        // portion of the buffer only
        buffer = buffer.slice(position)
      }
    }

    function parseEventStreamLine(
        lineBuffer,
        index,
        fieldLength,
        lineLength
    ) {
      if (lineLength === 0) {
        // We reached the last line of this event
        if (data.length > 0) {
          onParse({
            type: 'event',
            id: eventId,
            event: eventName || undefined,
            data: data.slice(0, -1) // remove trailing newline
          })

          data = ''
          eventId = undefined
        }
        eventName = undefined
        return
      }

      const noValue = fieldLength < 0
      const field = lineBuffer.slice(
          index,
          index + (noValue ? lineLength : fieldLength)
      )
      let step = 0

      if (noValue) {
        step = lineLength
      } else if (lineBuffer[index + fieldLength + 1] === ' ') {
        step = fieldLength + 2
      } else {
        step = fieldLength + 1
      }

      const position = index + step
      const valueLength = lineLength - step
      const value = lineBuffer
          .slice(position, position + valueLength)
          .toString()

      if (field === 'data') {
        data += value ? `${value}\n` : '\n'
      } else if (field === 'event') {
        eventName = value
      } else if (field === 'id' && !value.includes('\u0000')) {
        eventId = value
      } else if (field === 'retry') {
        const retry = parseInt(value, 10)
        if (!Number.isNaN(retry)) {
          onParse({type: 'reconnect-interval', value: retry})
        }
      }
    }
  }

  function hasBom(buffer) {
    return BOM.every(
        (charCode, index) => buffer.charCodeAt(index) === charCode
    )
  }

  // @see https://github.com/sindresorhus/p-timeout
  function pTimeout(
      promise,
      options
  ) {
    const {
      milliseconds,
      fallback,
      message,
      customTimers = {setTimeout, clearTimeout}
    } = options

    let timer

    const cancelablePromise = new Promise((resolve, reject) => {
      if (typeof milliseconds !== 'number' || Math.sign(milliseconds) !== 1) {
        throw new TypeError(
            `Expected \`milliseconds\` to be a positive number, got \`${milliseconds}\``
        )
      }

      if (milliseconds === Number.POSITIVE_INFINITY) {
        resolve(promise)
        return
      }

      if (options.signal) {
        const {signal} = options
        if (signal.aborted) {
          reject(getAbortedReason(signal))
        }

        signal.addEventListener('abort', () => {
          reject(getAbortedReason(signal))
        })
      }

      timer = customTimers.setTimeout.call(
          undefined,
          () => {
            if (fallback) {
              try {
                resolve(fallback())
              } catch (error) {
                reject(error)
              }

              return
            }

            const errorMessage =
                typeof message === 'string'
                    ? message
                    : `Promise timed out after ${milliseconds} milliseconds`
            const timeoutError =
                message instanceof Error ? message : new Error(errorMessage)

            if (typeof promise.cancel === 'function') {
              promise.cancel()
            }

            reject(timeoutError)
          },
          milliseconds
      )
      ;(async () => {
        try {
          resolve(await promise)
        } catch (error) {
          reject(error)
        } finally {
          customTimers.clearTimeout.call(undefined, timer)
        }
      })()
    })

    cancelablePromise.clear = () => {
      customTimers.clearTimeout.call(undefined, timer)
      timer = undefined
    }

    return cancelablePromise
  }

  /**
   TODO: Remove below function and just 'reject(signal.reason)' when targeting Node 18.
   */
  function getAbortedReason(signal) {
    const reason =
        signal.reason === undefined
            ? getDOMException('This operation was aborted.')
            : signal.reason

    return reason instanceof Error ? reason : getDOMException(reason)
  }

  /**
   TODO: Remove AbortError and just throw DOMException when targeting Node 18.
   */
  function getDOMException(errorMessage) {
    return globalThis.DOMException === undefined
        ? new Error(errorMessage)
        : new DOMException(errorMessage)
  }
}

async function browserNormalFetch(url, headers, body, method) {
  console.log(headers)
  const res = await fetch(url, {
    method,
    body: (method.toLowerCase() !== 'get' && method.toLowerCase() !== 'head') ? JSON.stringify(body) : undefined,
    headers: headers
  })
  let responseHeaders = {}
  res.headers.forEach((value, name) => {
    responseHeaders[name] = value
  });
  let result = {
    status: res.status,
    statusText: res.statusText,
    body: await res.text(),
    headers: responseHeaders
  }
  console.log(res.headers)
  if (res.status !== 200) {
    result.error = {
      message: result.body,
      statusCode: res.status,
      statusText: res.statusText
    }
  }
  return result
}

module.exports = {ChatGPTPuppeteer}
