const delay = require('delay');
const Config = require('../utils/config')
const robot= require("@hurdlegroup/robotjs");
// const e = require("express");

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
        let success1 = (await page.title())?.includes('ChatGPT')
        let success2 = (await page.$x("//div[contains(., 'Get started')]"))?.length > 0 || (await page.$x("//div[contains(., 'Welcome')]"))?.length > 0
        console.log({success1, success2})
        let retry = 20;
        let y = 450
        let step = 10
        let met = false
        while (!success1 && !success2 && retry >= 0) {
            met = true
            await global.cgp.disconnectBrowser()
            console.log('click checkbox')
            robot.moveMouse(292, y)
            robot.mouseClick('left')
            // await page.mouse.click(x, y);
            await delay(3000)
            let browser = await global.cgp.browserInit()
            page = (await browser.pages())[0]
            success1 = (await page.title())?.includes('ChatGPT')
            success2 = (await page.$x("//div[contains(., 'Get started')]"))?.length > 0 || (await page.$x("//div[contains(., 'Welcome')]"))?.length > 0
            console.log({success1, success2})
            y += step
            if (y >= 500) {
                step = -10
            }
            if (y <= 400) {
                step += 10
            }
            retry--
        }
        console.log("solve simple captchas: done")
        if (met) {
            await global.cgp.init(false)
        }
    } catch (err) {
        console.warn(err)
    }
}

module.exports = {getOpenAIAuth}
