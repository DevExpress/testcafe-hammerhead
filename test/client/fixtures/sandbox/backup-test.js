var backup = hammerhead.sandboxUtils.backup;

test('backup.get should return the latest sandbox backup', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write('Hello!');
    iframe.contentDocument.close();

    strictEqual(backup.get(iframe.contentWindow), iframe.contentWindow['%hammerhead%'].sandbox);

    iframe.parentNode.removeChild(iframe);
});

module('regression');

test('"permission denied" error is raised when an iframe with a nested iframe is reloaded (GH-727)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../data/window-storage/iframe.html') })
        .then(function (iframe) {
            iframe.contentWindow.testFlag = true;

            return new hammerhead.Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });
                iframe.contentWindow.location.reload();
            });
        })
        .then(function (iframe) {
            var nestedIframe = iframe.contentDocument.getElementById('nestedIframe');

            ok(!iframe.contentWindow.testFlag, 'page reloaded');
            ok(nestedIframe.contentWindow['%hammerhead%']);
            iframe.parentElement.removeChild(iframe);
        });
});

