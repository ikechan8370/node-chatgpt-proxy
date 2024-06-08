function acquireLockAndPlus() {
    while (lock !== 0) {
        // wait for the lock to be released
    }
    global.lock = 1;
    processingCount++;
    releaseLock()
}
function acquireLockAndMinus() {
    while (lock !== 0) {
        // wait for the lock to be released
    }
    global.lock = 1;
    processingCount--;
    releaseLock()
}

function releaseLock() {
    global.lock = 0;
}

module.exports = {acquireLockAndMinus, acquireLockAndPlus, releaseLock}
