const delay = require("delay");
const { fetch, ProxyAgent } = require("undici");
// const { HttpsProxyAgent } = require("https-proxy-agent")
const Config = require('../utils/config')
global.getTokenBrowserMode = false
async function getAccessToken(token) {
    let accessToken = undefined
    let expires = undefined
    if (token) {
        if (token.length > 2500) {
            // next token
            // get accessToken
            if (global.getTokenBrowserMode) {
                let session = await global.cgp.getToken(token)
                console.log(session)
                accessToken = session?.accessToken
                expires = session?.expires
            } else {
                let headers = await global.cgp.getGetTokenHeaders()
                headers.Cookie += `__Secure-next-auth.session-token=${token}; `
                let option = {
                    method: "GET",
                    headers: Object.assign(headers, {
                        Referer: 'https://chatgpt.com/',
                        "Sec-Fetch-Dest":"document",
                        "Sec-Fetch-Mode":"navigate",
                        "Sec-Fetch-Site":"cross-site",
                        "Sec-Fetch-User":"?1",
                        "Upgrade-Insecure-Requests":"1",
                        "Accept-Encoding":"gzip, deflate, br, zstd",
                        "Accept-Language":"en-US,en;q=0.9",
                        "Cache-Control":"max-age=0"
                    })
                }
                let proxy = Config.proxy
                try {
                    if (proxy) {
                        const agent = new ProxyAgent(proxy)
                        option.dispatcher = agent
                    }
                    let sessionRsp = await fetch("https://chatgpt.com/api/auth/session", option)
                    if (sessionRsp.status !== 200) {
                        console.log('get token failed: ' + sessionRsp.status)
                        console.log('change to browser mode')
                        let session = await global.cgp.getToken(token)
                        console.log(session)
                        accessToken = session?.accessToken
                        expires = session?.expires
                        global.getTokenBrowserMode = true
                        // throw new Error('get token failed: ' + sessionRsp.status)
                    } else {
                        let session = await sessionRsp.json()
                        console.log(session)
                        accessToken = session.accessToken
                        expires = session.expires
                        if (!accessToken) {
                            console.log('get token failed: ' + sessionRsp.status)
                            console.log('change to browser mode')
                            let session = await global.cgp.getToken(token)
                            console.log(session)
                            accessToken = session?.accessToken
                            expires = session?.expires
                            global.getTokenBrowserMode = true
                        }
                    }
                } catch (err) {
                    console.error(err)
                    console.log('change to browser mode')
                    let session = await global.cgp.getToken(token)
                    console.log(session)
                    accessToken = session?.accessToken
                    expires = session?.expires
                    global.getTokenBrowserMode = true
                }
            }
        } else {
            // access token
            accessToken = token
        }
    }
    return {
        accessToken,
        expires
    }
}

async function sendRequestFull(uri, method, body, headers, onMessage) {
    let message = body.messages[0].content.parts[0]
    let parentMessageId = body.parent_message_id
    let messageId = body.messages[0].id
    let conversationId = body.conversation_id
    let model = body.model || 'auto'
    let token = headers['authorization'] ? headers['authorization'].split(" ")[1] : undefined
    let action = body.action
    let {accessToken} = await getAccessToken(token)

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

async function sendRequestNormal(uri, method, body = {}, headers = {}, cookies = {}) {
    try {
        let token = headers['authorization'] ? headers['authorization'].split(" ")[1] : undefined
        let {accessToken} = await getAccessToken(token)
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`
        }
        return await global.cgp.sendRequest(uri, method, body, headers, cookies)
    } catch (err) {
        console.log(err.message)
        if (err.message.indexOf('Execution context was destroyed') > -1) {
            await delay(1500)
            return await sendRequestNormal(uri, method, body, headers, cookies)
        }
    }


}

module.exports = {sendRequestFull, sendRequestNormal, getAccessToken}
