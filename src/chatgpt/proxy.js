const delay = require("delay");
const { fetch, ProxyAgent } = require("undici");
// const { HttpsProxyAgent } = require("https-proxy-agent")
const Config = require('../utils/config')

async function sendRequestFull(uri, method, body, headers, onMessage) {
    let message = body.messages[0].content.parts[0]
    let parentMessageId = body.parent_message_id
    let messageId = body.messages[0].id
    let conversationId = body.conversation_id
    let model = body.model || 'auto'
    let token = headers['authorization'] ? headers['authorization'].split(" ")[1] : undefined
    let action = body.action
    let accessToken = undefined
    if (token) {
        if (token.length > 2500) {
            // next token
            // get accessToken
            let cookies = await global.cgp.getCookies()
            let cookie = ''
            for (let c of cookies) {
                cookie += `${c.name}=${c.value}; `
            }
            cookie += `__Secure-next-auth.session-token=${token}; `
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
                    "Accept-Encoding":"gzip, deflate, br, zstd",
                    "Accept-Language":"en-US,en;q=0.9",
                    "Cache-Control":"max-age=0"
                }
            }
            let proxy = Config.proxy
            if (proxy) {
                const agent = new ProxyAgent(proxy)
                option.dispatcher = agent
            }
            let sessionRsp = await fetch("https://chatgpt.com/api/auth/session", option)
            let session = await sessionRsp.json()
            console.log(session)
            accessToken = session.accessToken
        } else {
            // access token
            accessToken = token
        }
    }
    try {
        let result = await global.cgp.sendMessage(message, accessToken, {
            parentMessageId, messageId, conversationId, model,
            onConversationResponse: onMessage, action
        })
        return result
    } catch (err) {
        console.log(err.message)
        if (err.message.indexOf('Execution context was destroyed') > -1) {
            await delay(1500)
            return await sendRequestFull(uri, method, body, headers, onMessage)
        }
    }

}

async function sendRequestNormal(uri, method, body, headers, cookies = {}) {
    try {
        return await global.cgp.sendRequest(uri, method, body, headers, cookies)
    } catch (err) {
        console.log(err.message)
        if (err.message.indexOf('Execution context was destroyed') > -1) {
            await delay(1500)
            return await sendRequestNormal(uri, method, body, headers, cookies)
        }
    }


}

module.exports = {sendRequestFull, sendRequestNormal}
