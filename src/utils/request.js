const initCycleTLS = require("@ikechan8370/cycletls");

const Config = require('./config')
const {sendRequestNormal} = require("../chatgpt/proxy");
let cycleTLS
initCycleTLS().then(r => {
  cycleTLS = r
})

const defaultHeaders = {
      // 'User-Agent': ua,
      Referer: 'https://chatgpt.com/',
      "Sec-Ch-Ua":'"Chromium";v="124", "Google Chrome";v="124", ";Not A Brand";v="99"',
      "Sec-Ch-Ua-Mobile":"?0",
      "Sec-Ch-Ua-Platform":'"Windows"',
      "Sec-Fetch-Dest":"document",
      "Sec-Fetch-Mode":"navigate",
      "Sec-Fetch-Site":"cross-site",
      "Sec-Fetch-User":"?1",
      "Upgrade-Insecure-Requests":"1",
      "Accept-Encoding":"gzip, deflate, br, zstd",
      "Accept-Language":"en-US,en;q=0.9",
      "Cache-Control":"max-age=0"
}

/**
 * request browser-like
 *
 * @param {"head" | "get" | "post" | "put" | "delete" | "trace" | "options" | "connect" | "patch"} method
 * @param {string} url
 * @param {string?} data
 * @param {Object} headers
 * @param {string?} proxy
 * @param {boolean} fallbackToBrowser
 * @return {Promise<import('cycletls').CycleTLSResponse>}
 */
async function request(method, url, data = undefined, headers = {}, proxy = Config.proxy, fallbackToBrowser = true) {
  try {
    const { ja3 } = await cgp.getJa3()
    let ua = await cgp.getUa()
    let cookies = await cgp.getCookies()
    let cookie = ''
    for (let c of cookies) {
      cookie += `${c.name}=${c.value}; `
    }
    headers = Object.assign(defaultHeaders, headers)
    headers['User-Agent'] = ua
    if (headers['Cookie']) {
      headers['Cookie'] += cookie
    } else {
      headers['Cookie'] = cookie
    }
    const response = await cycleTLS(url, {
      ja3: ja3,
      userAgent: ua,
      headers,
      proxy,
      body: data
    }, method);
    return response
  } catch (e) {
    // console.error(e)
    // fallback to browser
    if (fallbackToBrowser) {
      return await sendRequestNormal(url, method, data, headers, parseCookies(headers['Cookie']))
    }
  }
}

function parseCookies(cookieString) {
  if (!cookieString) {
    return undefined
  }

  const cookies = {};

  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.split('=').map(c => c.trim());
    cookies[name] = value;
  });

  return cookies;
}

process.on('exit', () => {
    cycleTLS.exit().then(r => {
        console.log('cycletls exit')
    });
})

module.exports = {
  request
}
