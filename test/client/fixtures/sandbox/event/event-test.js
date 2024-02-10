var browserUtils     = hammerhead.utils.browser;
var featureDetection = hammerhead.utils.featureDetection;
var eventUtils       = hammerhead.utils.event;
var eventSimulator   = hammerhead.sandbox.event.eventSimulator;

if (browserUtils.isWebKit) {
    asyncTest('the "Illegal invocation" error after svg element focused (#82)', function () {
        var $svgElement = $(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">' +
            '<rect id="rect" width="300" height="300" fill="red" tabIndex="1"></rect>' +
            '</svg>').appendTo('body');

        $('<div>').text('Before processDomMeth').appendTo('body');

        try {
            processDomMeth($svgElement[0]);
        }
        catch (e) {
            $('<div>').text('Error: ' + e.message).appendTo('body');
        }

        $('<div>').text('Text after processDomMeth').appendTo('body');

        var rectElement = document.getElementById('rect');

        rectElement.onfocus = function () {
            rectElement.onblur = function () {
                $('<div>').text('Inside blur').appendTo('body');
                ok(true);
                $('<div>').text('After assertion').appendTo('body');
                $svgElement.remove();
                $('<div>').text('After svg remove').appendTo('body');
                start();
            };
            $('<div>').text('Before blur').appendTo('body');
            var focusEvent = new Event('blur');

            rectElement.dispatchEvent(focusEvent);
        };
        $('<div>').text('Before focus').appendTo('body');
        var focusEvent = new Event('focus');

        rectElement.dispatchEvent(focusEvent);
    });
}

asyncTest('mouse events in iframe', function () {
    let simulatorMethods = [];
    let allEvents        = [];

    if (featureDetection.isTouchDevice) {
        simulatorMethods = [
            'touchstart',
            'touchend',
            'touchmove',
            'mousedown',
            'mouseup',
            'mousemove',
            'mouseover',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];

        allEvents = [
            'pointerdown',
            'touchstart',
            'pointerup',
            'touchend',
            'pointermove',
            'touchmove',
            'mousedown',
            'mouseup',
            'mousemove',
            'pointerover',
            'mouseover',
            'pointerenter',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];
    }
    else {
        simulatorMethods = [
            'mousedown',
            'mouseup',
            'mousemove',
            'mouseover',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];

        allEvents = [
            'pointerdown',
            'mousedown',
            'pointerup',
            'mouseup',
            'pointermove',
            'mousemove',
            'pointerover',
            'mouseover',
            'pointerenter',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];
    }

    return createTestIframe()
        .then(function (iframe) {
            iframe.style.width           = '300px';
            iframe.style.height          = '100px';
            iframe.style.border          = '5px solid black';
            iframe.style.padding         = '20px';
            iframe.style.backgroundColor = 'yellow';

            var div = document.createElement('div');

            div.style.display = 'inline-block';

            div.appendChild(iframe);
            document.body.appendChild(div);

            var actualEvents = [];

            var eventsInsideFrame = ['pointerover', 'mouseover', 'pointerenter', 'mouseenter'];

            if (!eventUtils.hasPointerEvents) {
                const pointerRegExp = /pointer(down|up|move|over|enter)/;

                allEvents = allEvents.filter(function (eventName) {
                    return !pointerRegExp.test(eventName);
                });

                eventsInsideFrame = eventsInsideFrame.filter(function (eventName) {
                    return !pointerRegExp.test(eventName);
                });
            }

            var getHandler = function (i) {
                return function () {
                    actualEvents.push(allEvents[i]);
                };
            };

            for (var i = 0; i < allEvents.length; i++)
                iframe.addEventListener(allEvents[i], getHandler(i));

            for (i = 0; i < simulatorMethods.length; i++)
                eventSimulator[simulatorMethods[i]](iframe, { clientX: 190, clientY: 130 });

            deepEqual(actualEvents, eventsInsideFrame);

            actualEvents = [];

            for (i = 0; i < simulatorMethods.length; i++)
                eventSimulator[simulatorMethods[i]](iframe, { clientX: 190, clientY: 70 });

            deepEqual(actualEvents, allEvents);

            document.body.removeChild(div);

            start();
        });
});
