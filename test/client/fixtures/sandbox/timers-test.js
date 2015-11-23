asyncTest('setTimeout script argument processing', function () {
    expect(2);

    var link        = document.createElement('a');
    var url         = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink = link;

    ok(window.testLink.href !== url);
    window.setTimeout('strictEqual(window.testLink.href, "' + url + '"); start();', 0);
});

asyncTest('setInterval script argument processing', function () {
    expect(2);

    var link          = document.createElement('a');
    var url           = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink   = link;

    ok(window.testLink.href !== url);
    window.intervalId = window.setInterval('strictEqual(window.testLink.href, "' + url +
                                           '"); clearInterval(window.intervalId); start();', 0);
});

asyncTest('setInterval method invocation by using ".call"', function () {
    expect(2);

    var link          = document.createElement('a');
    var url           = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink   = link;

    ok(window.testLink.href !== url);
    window.intervalId = window.setInterval.call(window, 'strictEqual(window.testLink.href, "' + url +
                                                        '"); clearInterval(window.intervalId); start();', 0);
});

asyncTest('setInterval method invocation by using ".apply"', function () {
    expect(2);

    var link          = document.createElement('a');
    var url           = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink   = link;

    ok(window.testLink.href !== url);
    window.intervalId = window.setInterval.apply(window, ['strictEqual(window.testLink.href, "' + url +
                                                          '"); clearInterval(window.intervalId); start();'], 0);
});

asyncTest('setTimeout method invocation by using ".call"', function () {
    expect(2);

    var link        = document.createElement('a');
    var url         = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink = link;

    ok(window.testLink.href !== url);
    window.setTimeout.call(window, 'strictEqual(window.testLink.href, "' + url + '"); start();', 0);
});

asyncTest('setTimeout method invocation by using ".apply"', function () {
    expect(2);

    var link        = document.createElement('a');
    var url         = 'http://host.com/index.html';

    link.setAttribute('href', url);
    window.testLink = link;

    ok(window.testLink.href !== url);
    window.setTimeout.apply(window, ['strictEqual(window.testLink.href, "' + url + '"); start();', 0]);
});
