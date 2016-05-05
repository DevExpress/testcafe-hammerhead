/*hammerhead|script-processing-header|start*/var __w$= typeof window!=="undefined"&&window;__w$ && __w$["hammerhead|process-dom-method"] && __w$["hammerhead|process-dom-method"]();var __get$Loc=__w$?__w$.__get$Loc:function(l){return l},__set$Loc=__w$?__w$.__set$Loc:function(l,v){return l = v},__set$=__w$?__w$.__set$:function(o,p,v){return o[p] = v},__get$=__w$?__w$.__get$:function(o,p){return o[p]},__call$=__w$?__w$.__call$:function(o,p,a){return o[p].apply(o,a)},__get$Eval=__w$?__w$.__get$Eval:function(e){return e},__proc$Script=__w$?__w$.__proc$Script:function(s){return s};/*hammerhead|script-processing-header|end*/
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
        fn =  __get$(live,j);
        if ( fn.live === event.type ||
             fn.altLive && jQuery.inArray(event.type, fn.altLive) > -1 ) {

            data =  __get$(fn,"data");
            if ( !(data.beforeFilter &&  __get$(data.beforeFilter,event.type) &&
                   ! __call$(data.beforeFilter,event.type,[event])) ) {
                selectors.push( fn.selector );
            }
        } else {
            delete live[j];
        }
    }

    match = jQuery(  __get$(event,"target") ).closest( selectors, event.currentTarget );

    for ( i = 0, l =  __get$(match,"length"); i < l; i++ ) {
        for ( j in live ) {
            fn =  __get$(live,j);
            elem =  __get$(match,i).elem;
            related = null;

            if (  __get$(match,i).selector === fn.selector ) {
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

    for ( i = 0, l =  __get$(elems,"length"); i < l; i++ ) {
        match =  __get$(elems,i);
        event.currentTarget = match.elem;
         __set$(event,"data",__get$(match.fn,"data"));
        if ( match.fn.apply( match.elem, args ) === false ) {
            stop = false;
            break;
        }
    }

    return stop;
}
