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

    var iframeTaskScriptTempate = [
        'window["%hammerhead%"].get("./utils/destination-location").forceLocation("{{{location}}}");',
        'window["%hammerhead%"].start({',
        '    referer : "{{{referer}}}",',
        '    cookie: "{{{cookie}}}",',
        '    serviceMsgUrl : "{{{serviceMsgUrl}}}",',
        '    sessionId : "sessionId",',
        '    iframeTaskScriptTemplate: {{{iframeTaskScriptTemplate}}}',
        '});'
    ].join('');

    window.getIframeTaskScript = function (referer, serviceMsgUrl, location, cookie) {
        return iframeTaskScriptTempate
            .replace('{{{referer}}}', referer || '')
            .replace('{{{serviceMsgUrl}}}', serviceMsgUrl || '')
            .replace('{{{location}}}', location || '')
            .replace('{{{cookie}}}', cookie || '');
    };

    window.initIframeTestHandler = function (e) {
        var referer          = "http://localhost/sessionId/https://example.com";
        var location         = "http://localhost/sessionId/https://example.com";
        var serviceMsgUrl    = "/service-msg/100";
        var iframeTaskScript = window.getIframeTaskScript(referer, serviceMsgUrl, location).replace(/"/g, '\\"');

        if (e.iframe.id.indexOf('test') !== -1) {
            e.iframe.contentWindow.eval.call(e.iframe.contentWindow, [
                'window["%hammerhead%"].get("./utils/destination-location").forceLocation("' + location + '");',
                'window["%hammerhead%"].start({',
                '    referer : "' + referer + '",',
                '    serviceMsgUrl : "' + serviceMsgUrl + '",',
                '    sessionId : "sessionId",',
                '    iframeTaskScriptTemplate: "' + iframeTaskScript + '"',
                '});'
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
