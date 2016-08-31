var Promise   = hammerhead.Promise;
var listeners = hammerhead.eventSandbox.listeners;

function checkPage (url) {
    return new Promise(function (resolve) {
        var iframe = document.createElement('iframe');

        iframe.src = '/redirect-to-hammerhead?page=' + encodeURIComponent(window.getCrossDomainPageUrl(url));

        var handler = function (e) {
            iframe.parentElement.removeChild(iframe);
            listeners.removeInternalEventListener(window, ['message'], handler);
            resolve(e.data);
        };

        listeners.addInternalEventListener(window, ['message'], handler);
        document.body.appendChild(iframe);
    });
}

asyncTest('Local storage', function () {
    checkPage('../data/redirect-watch/local-storage.html')
        .then(function (result) {
            ok(JSON.parse(result)['local-storage-test-finished']);
            start();
        });
});

asyncTest('Link', function () {
    checkPage('../data/redirect-watch/link.html')
        .then(function (result) {
            ok(JSON.parse(result)['link-test-finished']);
            start();
        });
});

asyncTest('Location', function () {
    checkPage('../data/redirect-watch/location.html')
        .then(function (result) {
            ok(JSON.parse(result)['location-test-finished']);
            start();
        });
});

asyncTest('Meta', function () {
    checkPage('../data/redirect-watch/meta.html')
        .then(function (result) {
            ok(JSON.parse(result)['meta-test-finished']);
            start();
        });
});

asyncTest('Form', function () {
    checkPage('../data/redirect-watch/form.html')
        .then(function (result) {
            ok(JSON.parse(result)['form-test-finished']);
            start();
        });
});

asyncTest('Download', function () {
    checkPage('../data/redirect-watch/download.html')
        .then(function (result) {
            ok(JSON.parse(result)['download-test-finished']);
            start();
        });
});

asyncTest('Set of iframes', function () {
    checkPage('../data/redirect-watch/set-of-iframes.html')
        .then(function (result) {
            ok(JSON.parse(result)['set-of-iframes-test-finished']);
            start();
        });
});
