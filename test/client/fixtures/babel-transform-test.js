module('regression');

asyncTest('should not throw an error after for...of loop transformation (GH-1231)', function () {
    var iframe = document.createElement('iframe');
    var div    = document.createElement('div');

    iframe.id  = 'test' + Date.now();
    iframe.src = window.QUnitGlobals.getResourceUrl('../data/iframe/simple-iframe.html');

    iframe.addEventListener('load', function () {
        iframe.contentDocument.body.appendChild(div);
        document.body.removeChild(iframe);

        try {
            div.parentNode.removeChild(div);
            ok(true);
        }
        catch (e) {
            ok(false);
        }

        start();
    });

    document.body.appendChild(iframe);
});
