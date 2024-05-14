const delay = require('delay');
const random = import('random');
const {ChatGPTPuppeteer} = require('./full-browser');
const Config = require('../utils/config')
let hasRecaptchaPlugin = !!Config['2captchaToken']
var robot= require("@hurdlegroup/robotjs");

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

async function solveSimpleCaptchas(page) {
    let x = 275
    let y = 300
    // await page.evaluate((x, y) => {
    //     const marker = document.createElement('div');
    //     marker.style.position = 'absolute';
    //     marker.style.left = `${x}px`;
    //     marker.style.top = `${y}px`;
    //     marker.style.width = '10px';
    //     marker.style.height = '10px';
    //     marker.style.backgroundColor = 'red';
    //     marker.style.border = '2px solid black';
    //     marker.style.borderRadius = '50%';
    //     marker.style.zIndex = '10000'; // Ensure it appears on top
    //     document.body.appendChild(marker);
    // }, x, y);
    try {

        console.log("start to solve simple captchas")
        const res1 = await page.$x("//div[contains(., 'ChatGPT is at capacity')]")
        console.log(res1)
        let success1 = (res1?.length || 0) > 0
        const res2 = await page.$x("//div[contains(., 'Get started')]")
        console.log(res2)
        let success2 = (res2?.length || 0) > 0

        let y = 410
        let step = 10
        while (!success1 && !success2) {
            await global.cgp.disconnectBrowser()
            console.log('click checkbox')
            robot.moveMouse(292, y)
            robot.mouseClick('left')
            // await page.mouse.click(x, y);
            await delay(3000)
            let browser = await global.cgp.browserInit()
            page = (await browser.pages())[0]
            success1 = (await page.$x("//div[contains(., 'ChatGPT is at capacity')]"))?.length > 0
            success2 = (await page.$x("//div[contains(., 'Get started')]"))?.length > 0
            y += step
            if (y >= 500) {
                step = -10
            }
            if (y <= 400) {
                step += 10
            }
        }
        console.log("solve simple captchas: done")
        await global.cgp.init()
    } catch (err) {
        console.warn(err)
    }
}

module.exports = {getOpenAIAuth}
