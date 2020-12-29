

var noopUrl = window.QUnitGlobals.getResourceUrl('../data/import-script/noop.js');
var isImportSupported = true;

try {
    eval('import("' + noopUrl + '")');
}
catch (e) {
    isImportSupported = false;
}

if (isImportSupported) {
    test('An `import` context should not be lost when it is used in the evaluated code (GH-2122)', function () {
        createTestIframe({ src: getSameDomainPageUrl('../data/import-script/eval-dynamic-import.html') });

        return new Promise(function (resolve) {
            window.addEventListener('message', function (e) {
                if (e.data.type === 'gh2122')
                    resolve(e.data.message);
            });
        })
            .then(function (message) {
                strictEqual(message, './sub-dir/gh2122.js is loaded');
            });
    });

    module('regression');

    test('Process about:blank page (GH-2399)', function () {
        createTestIframe({ src: getSameDomainPageUrl('../data/import-script/about-blank.html') });

        return new Promise(function (resolve) {
            window.addEventListener('message', function (e) {
                if (e.data.type === 'gh2399')
                    resolve(e.data.message);
            });
        })
            .then(function (message) {
                strictEqual(message, 'about:blank');
            });
    });
}
