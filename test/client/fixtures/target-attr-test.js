var nativeMethods = hammerhead.nativeMethods;

QUnit.testStart(function () {
    window.name = 'window_name';
});

module('"_blank" target attribute');

function createTestedLink () {
    var link = document.createElement('a');

    link.onclick = function () {
        return false;
    };

    document.body.appendChild(link);

    return link;
}

function checkLinkTarget (link, real, primary) {
    strictEqual(link.target, real);
    strictEqual(link.getAttribute('target'), primary);
}

function provokeTargetCalculation (link) {
    link.click();
}

test('set attribute', function () {
    var link = createTestedLink();

    link.setAttribute('target', '_blank');
    checkLinkTarget(link, '_top', '_blank');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', '_blank');

    link.setAttribute('target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    link.setAttribute('target', 'unknow_window');
    checkLinkTarget(link, '_top', 'unknow_window');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'unknow_window');

    link.setAttribute('target', '_self');
    checkLinkTarget(link, '_self', '_self');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_self', '_self');

    document.body.removeChild(link);
});

test('set property', function () {
    var link = createTestedLink();

    setProperty(link, 'target', '_blank');
    checkLinkTarget(link, '_top', '_blank');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', '_blank');

    setProperty(link, 'target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    setProperty(link, 'target', 'unknow_window');
    checkLinkTarget(link, '_top', 'unknow_window');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'unknow_window');

    setProperty(link, 'target', '_self');
    checkLinkTarget(link, '_self', '_self');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_self', '_self');

    document.body.removeChild(link);
});

test('process html', function () {
    var container = document.createElement('div');

    document.body.appendChild(container);

    setProperty(container, 'innerHTML',
        '<a href="about:blank" target="_blank" onclick="return false;"></a>' +
        '<a href="about:blank" target="unknow_window" onclick="return false;"></a>' +
        '<a href="about:blank" target="window_name" onclick="return false;"></a>' +
        '<a href="about:blank" target="_self" onclick="return false;"></a>'
    );

    var children = container.children;

    checkLinkTarget(children[0], '_top', '_blank');
    checkLinkTarget(children[1], 'unknow_window', 'unknow_window');
    checkLinkTarget(children[2], 'window_name', 'window_name');
    checkLinkTarget(children[3], '_self', '_self');

    provokeTargetCalculation(children[0]);
    provokeTargetCalculation(children[1]);
    provokeTargetCalculation(children[2]);
    provokeTargetCalculation(children[3]);

    checkLinkTarget(children[0], '_top', '_blank');
    checkLinkTarget(children[1], '_top', 'unknow_window');
    checkLinkTarget(children[2], 'window_name', 'window_name');
    checkLinkTarget(children[3], '_self', '_self');

    document.body.removeChild(container);
});

test('change window name', function () {
    var link = createTestedLink();

    link.setAttribute('target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    window.name = 'unknow_window';
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'window_name');

    window.name = 'window_name';
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    document.body.removeChild(link);
});

test('window.open', function () {
    var nativeWindowOpen = nativeMethods.windowOpen;
    var targets          = [];

    nativeMethods.windowOpen = function (url, target) {
        targets.push(target);
    };

    window.open('http://some-url.com/', '_self');
    window.open('http://some-url.com/', '_blank');
    window.open('http://some-url.com/', 'window_name');
    window.open('http://some-url.com/', 'unknow_name');
    window.open('http://some-url.com/');

    strictEqual(targets.length, 5);
    strictEqual(targets[0], '_self');
    strictEqual(targets[1], '_top');
    strictEqual(targets[2], 'window_name');
    strictEqual(targets[3], '_top');
    strictEqual(targets[4], '_self');

    nativeMethods.windowOpen = nativeWindowOpen;
});

test('case insensitive target="_blank"', function () {
    var link = document.createElement('a');

    link.setAttribute('target', '_Blank');
    checkLinkTarget(link, '_top', '_Blank');
});

test('all possible elements', function () {
    var tagNames = ['a', 'form', 'area', 'base'];
    var el       = null;

    for (var i = 0; i < tagNames.length; i++) {
        el = document.createElement(tagNames[i]);

        el.setAttribute('target', '_blank');
        checkLinkTarget(el, '_top', '_blank');

        el.setAttribute('target', '_self');
        checkLinkTarget(el, '_self', '_self');

        setProperty(el, 'target', '_blank');
        checkLinkTarget(el, '_top', '_blank');
    }
});
