// A minimal async mutex that serializes asynchronous operations.
//
// The Chargy verification core and the single Electron renderer it runs in are
// designed for one document at a time. The HTTP API, however, can receive many
// concurrent requests. Without serialization two requests could interleave on
// the shared renderer/Chargy state and corrupt each other's results.
//
// createMutex() returns an object with runExclusive(fn): the given function is
// only invoked once all previously enqueued functions have settled. The caller
// still receives the original resolution or rejection of its own function.

function createMutex() {

    let tail = Promise.resolve();

    function runExclusive(fn) {

        const run = tail.then(() => fn());

        // Keep the internal chain alive even if fn rejects, so a single failing
        // operation does not deadlock everything queued behind it.
        tail = run.then(() => undefined, () => undefined);

        return run;

    }

    return {
        runExclusive
    };

}

module.exports = {
    createMutex
};
