const { fetchSSE } = require('../utils/fetch-sse')
const { ChatGPTPuppeteer } = require('../browser/full-browser')
async function sendRequest(uri, method, data, headers, cfClearanceToken, userAgent, cookies) {
    let newCookie = Object.keys(cookies).map(ckKey => `${ckKey}=${cookies[ckKey].value}`).join("; ")
    try {
        let combinedHeaders = {
            'authorization': headers['authorization'],
            'content-type': 'application/json',
            // 'Cookie': newCookie,
            'cookie': `cf_clearance=${cfClearanceToken}; `,
            // 'host': 'chat.openai.com',
            'x-openai-assistant-app-id': '',
            // 'Connection': 'close',
            "accept": "text/event-stream",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-XA;q=0.7,ja-JP;q=0.6,ja;q=0.5,zh-TW;q=0.4",
            "referer": "https://chat.openai.com/" + "chat",
            'user-agent': userAgent,
            'Origin': 'https://chat.openai.com',
            'accept-encoding': 'gzip, deflate, br',
            'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'dnt': 1
        }

        await fetchSSE(
            `https://chat.openai.com${uri}`,
            {
                headers: combinedHeaders,
                body: JSON.stringify(data),
                method,
            }
        )
    } catch (e) {
        console.error(e)
    }

}
async function sendRequestFull(uri, method, body, headers, onMessage) {
    if (uri === '/backend-api/conversation') {
        let message = body.messages[0].content.parts[0]
        let parentMessageId = body.parent_message_id
        let messageId = body.messages[0].id
        let conversationId = body.conversation_id
        let token = headers['authorization'].split(" ")[1]
        await global.cgp.sendMessage(message, token, {
            parentMessageId, messageId, conversationId,
            onConversationResponse: onMessage
        })
    } else {
        let newHeaders = {
            'content-type': 'application/json',
            'x-openai-assistant-app-id': '',
            "accept": "application/json",
            'Authorization': headers['authorization']
        }
        return await global.cgp.sendRequest(uri, method, body, newHeaders)
    }


}
module.exports = { sendRequest, sendRequestFull }