module('regression');

asyncTest('parameters must pass correctly in xhr event handlers (T239198)', function () {
    var request = new XMLHttpRequest();

    // NOTE: check XHR is wrapped
    ok(request.hasOwnProperty('addEventListener'));

    request.addEventListener('progress', function (event) {
        ok(event.target);
    }, true);

    request.addEventListener('load', function (event) {
        ok(event.target);
        start();
    }, true);

    request.addEventListener('error', function () {
        ok(false);
    });

    request.open('GET', '/xhr-large-response', true);
    request.send(null);
});


