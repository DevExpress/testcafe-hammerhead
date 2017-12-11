var Promise = hammerhead.Promise;

module('regression');

test('should prevent navigation from the about:blank page to the relative url (GH-645)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    return new Promise(function (resolve) {
        iframe.setAttribute('src', 'about:blank');
        iframe.addEventListener('load', resolve);
        document.body.appendChild(iframe);
    })
        .then(function () {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', resolve);
                setTimeout(resolve, 5000);

                iframe.contentWindow['%hammerhead%'].navigateTo('/test.html');
            });
        })
        .then(function (event) {
            ok(!event, 'should prevent navigation');
            iframe.parentNode.removeChild(iframe);
        });
});
