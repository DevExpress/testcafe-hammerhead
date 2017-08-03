module('regression');

test('should not throw an error after for...of loop transformation (GH-1231)', function () {
    var iframe = document.createElement('iframe');
    var div    = document.createElement('div');

    iframe.id  = 'test' + Date.now();
    iframe.src = window.QUnitGlobals.getResourceUrl('../data/iframe/simple-iframe.html');

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe.contentDocument.body.appendChild(div);
            document.body.removeChild(iframe);
            div.parentNode.removeChild(div);
        })
        .catch(function (err) {
            return err;
        })
        .then(function (err) {
            ok(!err, err);
        });

    document.body.appendChild(iframe);

    return promise;
});
