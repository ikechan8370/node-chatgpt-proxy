const fs = require('fs');
const defaultConfig = {
    proxy: '',
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    chromeTimeoutMS: 12000
}
let newJson = {}
fs.readFile('config.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    newJson = JSON.parse(data);
});

module.exports = Object.assign({}, defaultConfig, newJson);