const delay = require("delay");
const crypto = require('crypto');
const {request} = require("../utils/request");
global.getTokenBrowserMode = false

const cachedTokenMap = new Map()

async function getAccessToken(token) {
    let accessToken = undefined
    let expires = undefined
    if (token) {
        if (token.length > 2500) {
            // next token
            const hash = crypto.createHash('md5');
            hash.update(token);
            let tokenHash = hash.digest('hex')
            if (cachedTokenMap.has(tokenHash)) {
                let session = cachedTokenMap.get(tokenHash)
                accessToken = session?.accessToken
                expires = session?.expires
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
        let result = await cgp.sendMessage(message, accessToken, {
            parentMessageId, messageId, conversationId, model,
            onConversationResponse: onMessage, action
        })
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
