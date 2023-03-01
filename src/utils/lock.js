function acquireLockAndPlus() {
    while (global.lock !== 0) {
        // wait for the lock to be released
    }
    global.lock = 1;
    global.processingCount++;
    releaseLock()
}
function acquireLockAndMinus() {
    while (global.lock !== 0) {
        // wait for the lock to be released
    }
    global.lock = 1;
    global.processingCount--;
    releaseLock()
}

function releaseLock() {
    global.lock = 0;
}

module.exports = {acquireLockAndMinus, acquireLockAndPlus, releaseLock}