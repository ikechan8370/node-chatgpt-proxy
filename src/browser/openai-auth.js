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
        // setInterval(async () => {
        //     await page.mouse.click(275, 270);
        // }, 2000)
        await solveSimpleCaptchas(page)
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

async function solveSimpleCaptchas(page) {
    try {

        console.log("start to solve simple captchas")
        const res1 = await page.$x("//div[contains(., 'ChatGPT is at capacity')]")
        let success1 = !!res1?.length
        const res2 = await page.$x("//div[contains(., 'Welcome to ChatGPT')]")
        let success2 = !!res2?.length

        while (!success1 && !success2) {
            await page.mouse.click(275, 270);
            await delay(500)
            success1 = !!(await page.$x("//div[contains(., 'ChatGPT is at capacity')]"))?.length
            success2 = !!(await page.$x("//div[contains(., 'Welcome to ChatGPT')]"))?.length
        }
        console.log("solve simple captchas: done")
    } catch (err) {
        // console.warn(err)
    }
}

module.exports = {getOpenAIAuth}