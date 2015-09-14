module('regression');

asyncTest('B238528 - Unexpected text modifying during typing text in the search input on the http://www.google.co.uk', function () {
    var timeout = 100;

    var ready = function () {
        if (this.readyState === this.DONE) {
            ok(syncActionExecuted);
            start();
        }
    };

    var syncActionExecuted = false;

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = ready;
    xhr.open('GET', '/xhr-test/' + timeout);
    xhr.send(null);

    syncActionExecuted = true;
});

asyncTest('parameters must pass correctly in xhr event handlers (T239198)', function () {
    var request = new XMLHttpRequest();

    // NOTE: check XHR is wrapped
    ok(request.hasOwnProperty('addEventListener'));

    request.addEventListener('progress', function (e) {
        ok(e.target);
    }, true);

    request.addEventListener('load', function (e) {
        ok(e.target);
        start();
    }, true);

    request.addEventListener('error', function () {
        ok(false);
    });

    request.open('GET', '/xhr-large-response', true);
    request.send(null);
});


