const delay = require('delay');
const Config = require('../utils/config')
const robot= require("@hurdlegroup/robotjs");

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
        if (!page) {
            if (forceNewPage) {
                page = await browser.newPage()
            } else {
                page = (await browser.pages())[0] || (await browser.newPage())
            }
            page.setDefaultTimeout(timeoutMs)
        }
        await page.goto('https://chatgpt.com', {
            waitUntil: 'networkidle2'
        })
        await solveSimpleCaptchas(page)

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

/**
 *
 * @param page
 * @param {boolean?} init if true, will call global.cgp.init after captcha solved
 * @return {Promise<void>}
 */
async function solveSimpleCaptchas(page, init = true) {
    try {
        console.log("start to solve simple captchas")
        let success1 = (await page.title())?.includes('ChatGPT')
        let success2 = (await page.$x("//div[contains(., 'Get started')]"))?.length > 0 || (await page.$x("//div[contains(., 'Welcome')]"))?.length > 0
        console.log({success1, success2})
        let retry = 20;
        let met = false
        let ys = [400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500]
        while (!success1 && !success2 && retry >= 0) {
            console.log('captcha still exists, try to solve it, wait for 3 seconds, just be patient')
            met = true
            await global.cgp.disconnectBrowser()
            console.log('click checkbox')
            for (let cy of ys) {
                robot.moveMouse(292, cy)
                robot.mouseClick('left')
            }
            await delay(3000)
            let browser = await global.cgp.browserInit()
            page = (await browser.pages())[0]
            success1 = (await page.title())?.includes('ChatGPT')
            success2 = (await page.$x("//div[contains(., 'Get started')]"))?.length > 0 || (await page.$x("//div[contains(., 'Welcome')]"))?.length > 0
            console.log({success1, success2})
            retry--
        }
        console.log("solve simple captchas: done")
        if (met && init) {
            await global.cgp.init(false)
        }
    } catch (err) {
        console.warn(err)
    }
}

module.exports = {getOpenAIAuth, solveSimpleCaptchas}
