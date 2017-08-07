module('regression');

test('should not throw an error after for...of loop transformation (GH-1231)', function () {
    return window.createTestIframe(window.getSameDomainPageUrl('../data/iframe/simple-iframe.html'))
        .then(function (iframe) {
            var div = document.createElement('div');

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
});
