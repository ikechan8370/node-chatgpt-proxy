const lodash = require('lodash');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

let puppeteer = {}
const Config = require('../utils/config')

class Puppeteer {
    constructor() {
        let args = [
            '--exclude-switches',
            '--no-sandbox',
            '--remote-debugging-port=51777',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--ignore-certificate-errors',
            '--no-first-run',
            '--no-service-autorun',
            '--password-store=basic',
            '--system-developer-mode',
            '--mute-audio',
            '--disable-default-apps',
            '--no-zygote',
            '--disable-accelerated-2d-canvas',
            '--disable-web-security',
            `--proxy-server=${Config.proxy}`
            // '--shm-size=1gb'
        ]
        // if (Config.proxy) {
        //     args.push(`--proxy-server=${Config.proxy}`)
        // }
        this.browser = false
        this.lock = false
        this.config = {
            headless: false,
            args
        }

        if (Config.chromePath) {
            this.config.executablePath = Config.chromePath
        }
    }

    async initPupp() {
        if (!lodash.isEmpty(puppeteer)) return puppeteer
        puppeteer = (await import('puppeteer-extra')).default
        const pluginStealth = StealthPlugin()
        puppeteer.use(pluginStealth)
        if (Config['2captchaToken']) {
            const pluginCaptcha = (await import('puppeteer-extra-plugin-recaptcha')).default
            puppeteer.use(pluginCaptcha({
                provider: {
                    id: '2captcha',
                    token: Config['2captchaToken'] // REPLACE THIS WITH YOUR OWN 2CAPTCHA API KEY ⚡
                },
                visualFeedback: true
            }))
        }
        return puppeteer
    }

    /**
     * 初始化chromium
     */
    async browserInit() {
        await this.initPupp()
        if (this.browser) return this.browser
        if (this.lock) return false
        this.lock = true

        console.log('chatgpt puppeteer 启动中...')
        const browserURL = 'http://127.0.0.1:51777'
        try {
            this.browser = await puppeteer.connect({browserURL})
        } catch (e) {
            /** 初始化puppeteer */
            this.browser = await puppeteer.launch(this.config).catch((err) => {
                console.error(err.toString())
                if (String(err).includes('correct Chromium')) {
                    console.error('没有正确安装Chromium，可以尝试执行安装命令：node ./node_modules/puppeteer/install.js')
                }
            })
        }
        this.lock = false

        if (!this.browser) {
            console.error('chatgpt puppeteer 启动失败')
            return false
        }

        console.log('chatgpt puppeteer 启动成功')

        /** 监听Chromium实例是否断开 */
        this.browser.on('disconnected', (e) => {
            console.info('Chromium实例关闭或崩溃！')
            this.browser = false
        })

        return this.browser
    }
}

class ChatGPTPuppeteer extends Puppeteer {
    constructor(opts = {}) {
        super()
        const {
            email,
            password,
            markdown = true,
            debug = false,
            isGoogleLogin = false,
            minimize = true,
            captchaToken,
            executablePath
        } = opts

        this._email = email
        this._password = password

        this._markdown = !!markdown
        this._debug = !!debug
        this._isGoogleLogin = !!isGoogleLogin
        this._minimize = !!minimize
        this._captchaToken = captchaToken
        this._executablePath = executablePath
    }

    async getBrowser() {
        if (this.browser) {
            return this.browser
        } else {
            return await this.browserInit()
        }
    }

}

module.exports = {ChatGPTPuppeteer}