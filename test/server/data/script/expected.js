/*hammerhead|script|start*/if (typeof window !== 'undefined' && window){window['hammerhead|process-dom-method'] && window['hammerhead|process-dom-method']();if (window.__get$ && typeof __get$ === 'undefined')var __get$Loc = window.__get$Loc,__set$Loc = window.__set$Loc,__set$ = window.__set$,__get$ = window.__get$,__call$ = window.__call$,__get$Eval = window.__get$Eval,__proc$Script = window.__proc$Script,__proc$Html = window.__proc$Html,__get$PostMessage = window.__get$PostMessage,__get$ProxyUrl = window.__get$ProxyUrl,__rest$Array = window.__rest$Array,__rest$Object = window.__rest$Object,__arrayFrom$ = window.__arrayFrom$;} else {if (typeof __get$ === 'undefined')var __get$Loc = function(l){return l},__set$Loc = function(l,v){return l = v},__set$ = function(o,p,v){return o[p] = v},__get$ = function(o,p){return o[p]},__call$ = function(o,p,a){return o[p].apply(o,a)},__get$Eval = function(e){return e},__proc$Script = function(s){return s},__proc$Html = function(h){return h},__get$PostMessage = function(w,p){return arguments.length===1?w.postMessage:p},__get$ProxyUrl = function(u,d){return u},__rest$Array = function(a,i){return Array.prototype.slice.call(a, i)},__rest$Object = function(o,p){var k=Object.keys(o),n={};for(var i=0;i<k.length;++i)if(p.indexOf(k[i])<0)n[k[i]]=o[k[i]];return n},__arrayFrom$ = function(r){if(!r)return r;return!Array.isArray(r)&&"function"==typeof r[Symbol.iterator]?Array.from(r):r};if (typeof importScripts !== "undefined" && /\[native code]/g.test(importScripts.toString())) {var __getWorkerSettings$ = function () {return null};importScripts((location.origin || (location.protocol + "//" + location.host)) + "/worker-hammerhead.js");}}/*hammerhead|script|processing-header-end*/
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
        fn =  __get$(live,j) ;
        if ( fn.live === event.type ||
             fn.altLive && jQuery.inArray(event.type, fn.altLive) > -1 ) {

            data = fn.data;
            if ( !(data.beforeFilter &&  __get$(data.beforeFilter,event.type)  &&
                   ! __call$(data.beforeFilter,event.type,[event]) ) ) {
                selectors.push( fn.selector );
            }
        } else {
            delete live[j];
        }
    }

    match = jQuery( event.target ).closest( selectors, event.currentTarget );

    for ( i = 0, l = match.length; i < l; i++ ) {
        for ( j in live ) {
            fn =  __get$(live,j) ;
            elem =  __get$(match,i) .elem;
            related = null;

            if (  __get$(match,i) .selector === fn.selector ) {
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
        match =  __get$(elems,i) ;
        event.currentTarget = match.elem;
        event.data = match.fn.data;
        if ( match.fn.apply( match.elem, args ) === false ) {
            stop = false;
            break;
        }
    }

    return stop;
}


/*hammerhead|script|end*/