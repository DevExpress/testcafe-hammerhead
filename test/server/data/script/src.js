// fragment of the jQuery v1.4.1
function liveHandler( event ) {
    var stop, elems = [], selectors = [], args = arguments,
        related, match, fn, elem, j, i, l, data,
        live = jQuery.extend({}, jQuery.data( this, "events" ).live);

    // Make sure we avoid non-left-click bubbling in Firefox (#3861)
    if ( event.button && event.type === "click" ) {
        return;
    }

    for ( j in live ) {
        fn = live[j];
        if ( fn.live === event.type ||
             fn.altLive && jQuery.inArray(event.type, fn.altLive) > -1 ) {

            data = fn.data;
            if ( !(data.beforeFilter && data.beforeFilter[event.type] &&
                   !data.beforeFilter[event.type](event)) ) {
                selectors.push( fn.selector );
            }
        } else {
            delete live[j];
        }
    }

    match = jQuery( event.target ).closest( selectors, event.currentTarget );

    for ( i = 0, l = match.length; i < l; i++ ) {
        for ( j in live ) {
            fn = live[j];
            elem = match[i].elem;
            related = null;

            if ( match[i].selector === fn.selector ) {
                // Those two events require additional checking
                if ( fn.live === "mouseenter" || fn.live === "mouseleave" ) {
                    related = jQuery( event.relatedTarget ).closest( fn.selector )[0];
                }

                if ( !related || related !== elem ) {
                    elems.push({ elem: elem, fn: fn });
                }
            }
        }
    }

    for ( i = 0, l = elems.length; i < l; i++ ) {
        match = elems[i];
        event.currentTarget = match.elem;
        event.data = match.fn.data;
        if ( match.fn.apply( match.elem, args ) === false ) {
            stop = false;
            break;
        }
    }

    return stop;
}

//# sourceMappingURL=/src.js.map