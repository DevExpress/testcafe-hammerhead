module('regression');

test('should not throw an error after for...of loop transformation (GH-1231)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../data/iframe/simple-iframe.html') })
        .then(function (iframe) {
            var div = document.createElement('div');

            iframe.contentDocument.body.appendChild(div);
            document.body.removeChild(iframe);
            div.parentNode.removeChild(div);
        })
        .catch(function (err) {
            console.log(err);
            return err;
        })
        .then(function (err) {
            console.log(err);
            ok(!err, err);
        });
});
