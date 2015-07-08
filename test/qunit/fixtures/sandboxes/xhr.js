//T239198: TD15.1 - web page doesnt display correctly (hellomonday.com)
asyncTest('correct pass paremeters into xhr event handlers', function () {
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

    request.open('GET', '/xhr-large-response', true);
    request.send(null);
});


