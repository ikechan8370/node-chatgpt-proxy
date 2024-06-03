const delay = require('delay')
const cv = require('opencv4nodejs');
const { createCanvas, Image } = require('canvas');
const fs = require('fs');
const key = '__Secure-next-auth.session-token'
const robot= require("@hurdlegroup/robotjs");

async function loginByUsernameAndPassword(username, password) {
  const url = "https://chatgpt.com/auth/login"
  let turnstile = false
  /**
   *
   * @type {import('puppeteer').Browser}
   */
  let browser = await global.cgp.getBrowser()
  let page = await browser.newPage()
  await page.deleteCookie({
    name: key,
    domain: '.chatgpt.com'
  })
  try {
    await page.goto(url, {
      waitUntil: 'networkidle2'
    })
    await delay(500)
    let signupBtn = await page.waitForXPath("//button[contains(.//text(), '注册') or contains(.//text(), 'Sign up')]")
    if ((await page.$x("//a[contains(text(), 'Stay logged out')]"))?.length > 0) {
      const closeModalBtn = await page.waitForXPath('//a[contains(text(), "Stay logged out")]')
      await closeModalBtn.click()
      await delay(500)
      signupBtn = await page.waitForXPath("//button[contains(.//text(), '注册') or contains(.//text(), 'Sign up')]")
    }
    await signupBtn.click()
    await delay(3000)
    const loginBtn = await page.waitForXPath("//a[contains(text(), '登录') or contains(text(), 'Login')]")
    await loginBtn.click()
    await delay(1500)
    const emailInput = await page.waitForXPath("//input[@name='email']")
    await emailInput.focus()
    await emailInput.type(username)
    let continueBtn = await page.waitForXPath("//button[contains(.//text(), '继续') or contains(.//text(), 'Continue')]")
    await continueBtn.click()
    await delay(500)
    let passwordPromise = new Promise(async (resolve, reject) => {
      try {
        let passwordInput = await page.waitForXPath("//input[@name='password']")
        await passwordInput.focus()
        await passwordInput.type(password)
      } catch (err) {}
      resolve({})
    })
    let turnstilePromise = new Promise(async (resolve, reject) => {
      let retry = 10
      while (retry >= 0) {
        let screenshot = await page.screenshot()
        const screenshotPath = './screenshot.png';
        fs.writeFileSync(screenshotPath, screenshot);
        const screenshotImage = cv.imread(screenshotPath)
        const cfLogoImage = cv.imread('cloudflare.png');
        const matched = screenshotImage.matchTemplate(cfLogoImage, cv.TM_CCOEFF_NORMED);
        const minMax = matched.minMaxLoc();
        const maxVal = minMax.maxVal;
        const maxLoc = minMax.maxLoc;
        const threshold = 0.8;
        if (maxVal >= threshold) {
          console.log(`Turnstile found at: x=${maxLoc.x}, y=${maxLoc.y}`);
          resolve({
            x: maxLoc.x - 450,
            y: maxLoc.y + 1
          })
          return
        }
        retry--
        await delay(1000)
      }
      reject(new Error('Turnstile not found'))
    })
    let passwordRes = await Promise.race([passwordPromise, turnstilePromise])
    if (passwordRes.x) {
      turnstile = true
      console.log('disconnect browser first to bypass turnstile check')
      console.log(passwordRes)
      await global.cgp.disconnectBrowser()
      await delay(1000)
      let click = 5
      let interval = setInterval(() => {
        if (click >= 0) {
          robot.moveMouse(passwordRes.x, passwordRes.y)
          robot.mouseClick()
        }
        click--
        if (click < 0) {
          clearInterval(interval)
        }
      }, 3000)
      robot.mouseClick()
      await delay(8000)
      console.log("we believe turnstile is bypassed")
      clearInterval(interval)
      // captcha should be solved
      browser = await global.cgp.browserInit()
      await delay(2000)
      let pages = await browser.pages()
      page = pages.find(p => p.url().includes('auth0'))
      console.log(page.url())
      let passwordInput = await page.waitForXPath("//input[@name='password']")
      await passwordInput.focus()
      await passwordInput.type(password)
    }
    continueBtn = await page.waitForXPath("//button[contains(.//text(), '继续') or contains(.//text(), 'Continue')]")
    await delay(1000)
    await continueBtn.click()
    let retry = 10
    while (retry > 0) {
      const sessionToken = (await page.cookies()).find(ck => ck.name === key)?.value
      if (sessionToken) {
        console.log({
          username,
          sessionToken
        })
        return sessionToken
      }
      let errrr = false
      try {
        errrr = await page.$x('//span[@id="error-element-password"]')
      } catch (err) {
      }
      if (errrr?.length > 0) {
        console.log('password wrong')
        throw new Error('password wrong')
      }
      try {
        await continueBtn.click()
      } catch (err) {
      }
      await delay(1000)
      retry--
    }
    console.log('no cookie found, possibly login failed')
    await page.deleteCookie({
      name: key
    })
    await page.close()
    return null
  } catch (err) {
    console.error(err)
    throw err
  } finally {
    if (turnstile) {
      await global.cgp.init(false)
    }
    try {
      await page.close()
    } catch (err) {
    }
  }
}

module.exports = {
  loginByUsernameAndPassword
}
