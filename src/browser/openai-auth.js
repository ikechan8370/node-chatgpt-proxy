const delay = require('delay');
const random = import('random');
const {ChatGPTPuppeteer} = require('./full-browser');
const Config = require('../utils/config')
let hasRecaptchaPlugin = !!Config['2captchaToken']

async function getOpenAIAuth(opt = {}) {
    let {
        browser,
        page,
        timeoutMs = Config.chromeTimeoutMS,
        forceNewPage = false
    } = opt

    if (!browser) {
        browser = await global.cgp.getBrowser()
    }
    const origBrowser = browser
    const origPage = page

    try {
        const userAgent = await browser.userAgent()
        if (!page) {
            if (forceNewPage) {
                page = await browser.newPage()
            } else {
                page = (await browser.pages())[0] || (await browser.newPage())
            }
            page.setDefaultTimeout(timeoutMs)
        }
        await page.goto('https://chat.openai.com/auth/login', {
            waitUntil: 'networkidle2'
        })
        console.log('chatgpt checkForChatGPTAtCapacity')

        await checkForChatGPTAtCapacity(page)

        // NOTE: this is where you may encounter a CAPTCHA
        if (hasRecaptchaPlugin) {
            console.log('RecaptchaPlugin key exists, try to solve recaptchas')
            await page.solveRecaptchas()
        }

            let retry = 3
            while (retry > 0) {
                try {
                    await waitForConditionOrAtCapacity(page, () =>
                        page.waitForSelector('#__next .btn-primary', {timeout: timeoutMs / 3})
                    )
                } catch (e) {
                    await checkForChatGPTAtCapacity(page)
                }
                retry--
            }
            await waitForConditionOrAtCapacity(page, () =>
                page.waitForSelector('#__next .btn-primary', {timeout: timeoutMs / 3})
            )
            await delay(500)

        const pageCookies = await page.cookies()
        // console.log({pageCookies})
        const cookies = pageCookies.reduce(
            (map, cookie) => ({...map, [cookie.name]: cookie}),
            {}
        )

        const authInfo = {
            userAgent,
            clearanceToken: cookies.cf_clearance?.value,
            sessionToken: cookies['__Secure-next-auth.session-token']?.value,
            cookies
        }
        console.info('cf token获取成功')

        return authInfo
    } catch (err) {
        console.error(err)
    } finally {
        if (forceNewPage) {
            await page.close()
        }
        // await page.screenshot({
        //     type: 'png',
        //     path: './error.png'
        // })
        // if (origBrowser) {
        //     if (page && page !== origPage) {
        //         await page.close()
        //     }
        // } else if (browser) {
        //     await browser.close()
        // }
        //
        // page = null
        // browser = null
    }
}

async function checkForChatGPTAtCapacity(page, opts = {}) {
    const {
        timeoutMs = Config.chromeTimeoutMS, // 2 minutes
        pollingIntervalMs = 3000,
        retries = 10
    } = opts

    // console.log('checkForChatGPTAtCapacity', page.url())
    let isAtCapacity = false
    let numTries = 0

    do {
        try {
            await solveSimpleCaptchas(page)

            const res = await page.$x("//div[contains(., 'ChatGPT is at capacity')]")
            isAtCapacity = !!res?.length

            if (isAtCapacity) {
                break
            }
        } catch (err) {
            // ignore errors likely due to navigation
            ++numTries
            break
        }
    } while (isAtCapacity)
}

async function waitForConditionOrAtCapacity(
    page,
    condition,
    opts = {}
) {
    const {pollingIntervalMs = 500} = opts

    return new Promise((resolve, reject) => {
        let resolved = false

        async function waitForCapacityText() {
            if (resolved) {
                return
            }

            try {
                await checkForChatGPTAtCapacity(page)

                if (!resolved) {
                    setTimeout(waitForCapacityText, pollingIntervalMs)
                }
            } catch (err) {
                if (!resolved) {
                    resolved = true
                    return reject(err)
                }
            }
        }

        condition()
            .then(() => {
                if (!resolved) {
                    resolved = true
                    resolve()
                }
            })
            .catch((err) => {
                if (!resolved) {
                    resolved = true
                    reject(err)
                }
            })

        setTimeout(waitForCapacityText, pollingIntervalMs)
    })
}

async function solveSimpleCaptchas(page) {
    try {
        const verifyYouAreHuman = await page.$('text=Verify you are human')
        if (verifyYouAreHuman) {
            console.log('encounter cloudflare simple captcha "Verify you are human"')
            await delay(2000)
            await verifyYouAreHuman.click({
                delay: random.int(5, 25)
            })
            await delay(1000)
        }
        const verifyYouAreHumanCN = await page.$('text=确认您是真人')
        if (verifyYouAreHumanCN) {
            console.log('encounter cloudflare simple captcha "确认您是真人"')
            await delay(2000)
            await verifyYouAreHumanCN.click({
                delay: random.int(5, 25)
            })
            await delay(1000)
        }

        const cloudflareButton = await page.$('.hcaptcha-box')
        if (cloudflareButton) {
            await delay(2000)
            await cloudflareButton.click({
                delay: random.int(5, 25)
            })
            await delay(1000)
        }
    } catch (err) {
        // ignore errors
    }
}

module.exports = {getOpenAIAuth}