var EventEmitter = hammerhead.EventEmitter;
var browserUtils = hammerhead.utils.browser;

module('regression');

test('the "emit" function should not throw errors', function () {
    var emitter = new EventEmitter();

    window.eventCounter = [];

    emitter.on('event', function () {
        window.eventCounter.push('event');
    });

    return createTestIframe()
        .then(function (iframe) {
            emitter.on('event', new iframe.contentWindow.Function('top.eventCounter.push("iframe event")'));

            iframe.contentDocument.open();
            iframe.contentDocument.write('<body>Hello</body>');
            iframe.contentDocument.close();

            strictEqual(emitter.eventsListeners.event.length, 2);
            deepEqual(window.eventCounter, []);

            emitter.emit('event');

            strictEqual(emitter.eventsListeners.event.length, browserUtils.isIE ? 1 : 2);
            deepEqual(window.eventCounter, browserUtils.isIE ? ['event'] : ['event', 'iframe event']);

            emitter.emit('event');

            strictEqual(emitter.eventsListeners.event.length, browserUtils.isIE ? 1 : 2);
            deepEqual(window.eventCounter, browserUtils.isIE ? ['event', 'event'] : ['event', 'iframe event', 'event', 'iframe event']);
        });
});
