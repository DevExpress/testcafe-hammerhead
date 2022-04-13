var stackProcessing = hammerhead.sharedUtils.stackProcessing;
var urlUtils        = hammerhead.utils.url;

var urls = [
    '/fixtures/utils/replace-proxied-urls-in-stack-test.js',
    '/qunit-1.20.0.js',
];

var replacedUrls = urls.map(function (url) {
    var fullUrl = 'http://' + location.host + url;

    return {
        url:        fullUrl,
        checkedUrl: 'https://example.com' + url,
        proxiedUrl: urlUtils.getProxyUrl(fullUrl),
    };
});

function prepareStackUrls (stack) {
    for (var i = 0; i < replacedUrls.length; i++) {
        var replacedUrl = replacedUrls[i];
        var reqExpUrl   = new RegExp(replacedUrl.url, 'g');

        stack = stack.replace(reqExpUrl, replacedUrl.proxiedUrl);
    }

    return stack;
}

function checkProcessedStack (stack) {
    for (var i = 0; i < replacedUrls.length; i++) {
        var replacedUrl = replacedUrls[i];

        ok(stack.indexOf(replacedUrl.url) === -1, 'url');
        ok(stack.indexOf(replacedUrl.proxiedUrl) === -1, 'proxiedUrl');
        ok(stack.indexOf(replacedUrl.checkedUrl) > -1, 'checkedUrl');
    }
}

test('replace proxied urls in stack trace', function () {
    var stack    = null;
    var testCase = null;

    var testCases = [
        {
            name: 'function',
            fn:   function testFunction () {
                throw new Error('test');
            },
        },
        {
            name: 'eval',
            fn:   function () {
                eval('throw new Error("test");');
            },
        },
    ];

    for (var i = 0; i < testCases.length; i++) {
        testCase = testCases[i];

        try {
            testCase.fn();
        }
        catch (e) {
            stack = e.stack;
        }

        stack = prepareStackUrls(stack);

        var processedStack = stackProcessing.replaceProxiedUrlsInStack(stack);

        checkProcessedStack(processedStack);
    }
});
