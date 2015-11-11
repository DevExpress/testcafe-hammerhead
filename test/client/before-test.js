(function () {
    localStorage.clear();
    sessionStorage.clear();

    // NOTE: Prevent Hammerhead from processing testing environment resources. There are only testing environment
    // resources on the page when this script is being executed. So, we can add the hammerhead class to all scripts
    // and link elements on the page.
    $('script').addClass('script-hammerhead-shadow-ui');
    $('link').addClass('ui-stylesheet-hammerhead-shadow-ui');

    var hammerhead     = window['%hammerhead%'];
    var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');
    var INSTRUCTION    = hammerhead.get('../processing/script/instruction');
    var destLocation   = hammerhead.get('./utils/destination-location');

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');

    window.initIframeTestHandler = function (e) {
        if (e.iframe.id.indexOf('test') !== -1) {
            e.iframe.contentWindow.eval.call(e.iframe.contentWindow, [
                'window["%hammerhead%"].start({',
                '    referer : "http://localhost/sessionId/https://example.com",',
                '    serviceMsgUrl : "/service-msg/100",',
                '    sessionId : "sessionId"',
                '});',
                'window["%hammerhead%"].get("./utils/destination-location").forceLocation("http://localhost/sessionId/https://iframe.example.com")'
            ].join(''));
        }
    };

    hammerhead.start({ sessionId: 'sessionId' });

    window.overrideDomMeth = window[INTERNAL_PROPS.overrideDomMethodName];

    window[INTERNAL_PROPS.overrideDomMethodName] = function (el) {
        if (el)
            window.overrideDomMeth(el);
    };

    window.processScript = window[INSTRUCTION.processScript];
    window.getProperty   = window[INSTRUCTION.getProperty];
    window.setProperty   = window[INSTRUCTION.setProperty];
    window.callMethod    = window[INSTRUCTION.callMethod];
    window.getLocation   = window[INSTRUCTION.getLocation];
    window.hammerhead    = hammerhead;

    var globals = window.QUnitGlobals;

    window.getCrossDomainPageUrl = function (filePath) {
        return window.QUnitGlobals.crossDomainHostname + globals.getResourceUrl(filePath);
    };

    QUnit.config.testTimeout = 30000;
})();
