const delay = require("delay");

async function sendRequestFull(uri, method, body, headers, onMessage) {
    let message = body.messages[0].content.parts[0]
    let parentMessageId = body.parent_message_id
    let messageId = body.messages[0].id
    let conversationId = body.conversation_id
    let model = body.model || 'auto'
    let token = headers['authorization'] ? headers['authorization'].split(" ")[1] : undefined
    let action = body.action
    let authToken
    if (token) {
        let sessionRsp = await sendRequestNormal("https://chatgpt.com/api/auth/session", "GET", {}, {}, {
            '__Secure-next-auth.session-token': token
        })
        console.log(sessionRsp)
        authToken = JSON.parse(sessionRsp.body).accessToken
        console.log('authToken', authToken)
    }
    try {
        return await global.cgp.sendMessage(message, authToken, token, {
            parentMessageId, messageId, conversationId, model,
            onConversationResponse: onMessage, action
        })
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
