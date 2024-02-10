var browserUtils     = hammerhead.utils.browser;
// var featureDetection = hammerhead.utils.featureDetection;
// var eventUtils       = hammerhead.utils.event;
// var nativeMethods    = hammerhead.nativeMethods;
// var listeners        = hammerhead.sandbox.event.listeners;
// var focusBlur        = hammerhead.sandbox.event.focusBlur;
// var eventSimulator   = hammerhead.sandbox.event.eventSimulator;
// var listeningCtx     = hammerhead.sandboxUtils.listeningContext;

if (browserUtils.isWebKit) {
    asyncTest('the "Illegal invocation" error after svg element focused (#82)', function () {
        var $svgElement = $(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">' +
            '<rect id="rect" width="300" height="300" fill="red" tabIndex="1"></rect>' +
            '</svg>').appendTo('body');

        var $divElement = $('<div>').text('Before processDomMeth');

        $('body').append($divElement);

        processDomMeth($svgElement[0]);

        var $afterDiv = $('<div>').text('Text after processDomMeth');

        $('body').append($afterDiv);

        var rectElement = document.getElementById('rect');

        rectElement.onfocus = function () {
            rectElement.onblur = function () {
                ok(true);
                $svgElement.remove();
                start();
            };
            rectElement.blur();
        };
        rectElement.focus();
    });
}
