module('regression');

test('"string-trim" should not use the "String.prototype.trim" method (GH-609)', function () {
    var storedTrim = String.prototype.trim;

    // eslint-disable-next-line no-extend-native
    String.prototype.trim = function () {
        return 'overrided';
    };

    return createTestIframe()
        .then(function (iframe) {
            strictEqual(iframe.contentWindow['%hammerhead%'].utils.trim(' text '), 'text');

            // eslint-disable-next-line no-extend-native
            String.prototype.trim = storedTrim;
        });
});
