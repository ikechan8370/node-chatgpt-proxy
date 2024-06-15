const delay = require("delay");
const crypto = require('crypto');
const {request} = require("../utils/request");
global.getTokenBrowserMode = false

global.cachedTokenMap = new Map()

function purgeToken(token) {
    const hash = crypto.createHash('md5');
    hash.update(token);
    let tokenHash = hash.digest('hex')
    cachedTokenMap.delete(tokenHash)
}
async function getAccessToken(token, useCache = true) {
    let accessToken = undefined
    let expires = undefined
    if (token) {
        if (token.length > 2500) {
            // next token
            const hash = crypto.createHash('md5');
            hash.update(token);
            let tokenHash = hash.digest('hex')
            if (useCache && cachedTokenMap.has(tokenHash)) {
                let session = cachedTokenMap.get(tokenHash)
                // accessToken = session?.accessToken
                expires = session?.expires
                const expiresTime = new Date(expires);
                const expiresTimeMinus24Hours = new Date(expiresTime.getTime() - 24 * 60 * 60 * 1000);
                const now = new Date();
                if (now < expiresTimeMinus24Hours) {
                    accessToken = session?.accessToken
                } else {
                    cachedTokenMap.delete(tokenHash)
                    return await getAccessToken(token)
                }
            } else {
                // get accessToken
                if (getTokenBrowserMode) {
                    let session = await cgp.getToken(token)
                    logger.info(session)
                    accessToken = session?.accessToken
                    expires = session?.expires
                } else {
                    let cookie = `__Secure-next-auth.session-token=${token}; `
                    try {
                        const response = await request('get', 'https://chatgpt.com/api/auth/session', undefined, {
                            'Cookie': cookie,
                        })
                        if (response.status !== 200) {
                            logger.info('get token failed: ' + response.status)
                            logger.info('change to browser mode')
                            let session = await cgp.getToken(token)
                            logger.info(session)
                            accessToken = session?.accessToken
                            expires = session?.expires
                            global.getTokenBrowserMode = true
                            // throw new Error('get token failed: ' + sessionRsp.status)
                        } else {
                            let session = response.body
                            logger.info(session)
                            accessToken = session.accessToken
                            expires = session.expires
                            if (!accessToken) {
                                logger.info('get token failed: ' + response.status, session)
                                logger.info('change to browser mode')
                                let session = await cgp.getToken(token)
                                logger.info(session)
                                accessToken = session?.accessToken
                                expires = session?.expires
                                global.getTokenBrowserMode = true
                            }
                        }
                    } catch (err) {
                        logger.error(err)
                        logger.info('change to browser mode')
                        let session = await cgp.getToken(token)
                        logger.info(session)
                        accessToken = session?.accessToken
                        expires = session?.expires
                        global.getTokenBrowserMode = true
                    }
                }
                if (accessToken) {
                    cachedTokenMap.set(tokenHash, {accessToken, expires})
                    setTimeout(() => {
                        cachedTokenMap.delete(tokenHash)
                    }, 9 * 24 * 60 * 60 * 1000)
                }
            }
        } else {
            // access token
            accessToken = token
        }
    }
    return {
        accessToken,
        expires,
        isNext: token.length > 2500
    }
}

async function sendRequestFull(uri, method, body, headers, onMessage, retry = false) {
    let message = body.messages[0].content.parts[0]
    let parentMessageId = body.parent_message_id
    let messageId = body.messages[0].id
    let conversationId = body.conversation_id
    let model = body.model || 'auto'
    let token = headers['authorization'] ? headers['authorization'].split(" ")[1] : undefined
    let action = body.action
    let {accessToken, isNext} = await getAccessToken(token)

    try {
        let result = await cgp.sendMessage(message, accessToken, {
            parentMessageId, messageId, conversationId, model,
            onConversationResponse: onMessage, action
        })
        if (!retry && isNext && result.status === 401) {
            purgeToken(token)
            return await sendRequestFull(uri, method, body, headers, onMessage, true)
        }
        return result
    } catch (err) {
        logger.info(err.message)
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
        return await cgp.sendRequest(uri, method, body, headers, cookies)
    } catch (err) {
        logger.info(err.message)
        if (err.message.indexOf('Execution context was destroyed') > -1) {
            await delay(1500)
            return await sendRequestNormal(uri, method, body, headers, cookies)
        }
    }


}

module.exports = {sendRequestFull, sendRequestNormal, getAccessToken}
