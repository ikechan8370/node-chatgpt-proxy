const fs = require('fs');
const defaultConfig = {
    proxy: '',
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    chromeTimeoutMS: 12000
}
let newJson = {}
let data = fs.readFileSync('config.json', 'utf8')
newJson = Object.assign({}, defaultConfig, JSON.parse(data))
module.exports = newJson