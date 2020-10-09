var nativeMethods = hammerhead.nativeMethods;

asyncTest('setTimeout script argument processing', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.setTimeout('strictEqual(window.testAnchor.href, "' + url + '"); start();', 0);
});

asyncTest('setInterval script argument processing', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.intervalId = window.setInterval('strictEqual(window.testAnchor.href, "' + url +
                                           '"); clearInterval(window.intervalId); start();', 0);
});

asyncTest('setInterval method invocation by using ".call"', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.intervalId = window.setInterval.call(window, 'strictEqual(window.testAnchor.href, "' + url +
                                                        '"); clearInterval(window.intervalId); start();', 0);
});

asyncTest('setInterval method invocation by using ".apply"', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.intervalId = window.setInterval.apply(window, ['strictEqual(window.testAnchor.href, "' + url +
                                                          '"); clearInterval(window.intervalId); start();'], 0);
});

asyncTest('setTimeout method invocation by using ".call"', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.setTimeout.call(window, 'strictEqual(window.testAnchor.href, "' + url + '"); start();', 0);
});

asyncTest('setTimeout method invocation by using ".apply"', function () {
    expect(2);

    var anchor = document.createElement('a');
    var url    = 'http://host.com/index.html';

    anchor.setAttribute('href', url);
    window.testAnchor = anchor;

    notEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), url);
    window.setTimeout.apply(window, ['strictEqual(window.testAnchor.href, "' + url + '"); start();', 0]);
});

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window.setTimeout, nativeMethods.setTimeout, 'setTimeout');
    window.checkStringRepresentation(window.setInterval, nativeMethods.setInterval, 'setInterval');
});
