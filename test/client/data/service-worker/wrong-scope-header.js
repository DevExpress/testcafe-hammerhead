/*hammerhead|script|start*/
var __swScopeHeaderValue = "/some/";
if (typeof window !== 'undefined' && window) {
    window['hammerhead|process-dom-method'] && window['hammerhead|process-dom-method']();
    if (window.__get$ && typeof __get$ === 'undefined') var __get$Loc = window.__get$Loc, __set$Loc = window.__set$Loc,
        __set$ = window.__set$, __get$ = window.__get$, __call$ = window.__call$, __get$Eval = window.__get$Eval,
        __proc$Script = window.__proc$Script, __proc$Html = window.__proc$Html,
        __get$PostMessage = window.__get$PostMessage, __get$ProxyUrl = window.__get$ProxyUrl,
        __rest$Array = window.__rest$Array, __rest$Object = window.__rest$Object;
} else {
    if (typeof __get$ === 'undefined') var __get$Loc = function (l) {
        return l
    }, __set$Loc = function (l, v) {
        return l = v
    }, __set$ = function (o, p, v) {
        return o[p] = v
    }, __get$ = function (o, p) {
        return o[p]
    }, __call$ = function (o, p, a) {
        return o[p].apply(o, a)
    }, __get$Eval = function (e) {
        return e
    }, __proc$Script = function (s) {
        return s
    }, __proc$Html = function (h) {
        return h
    }, __get$PostMessage = function (w, p) {
        return arguments.length === 1 ? w.postMessage : p
    }, __get$ProxyUrl = function (u, d) {
        return u
    }, __rest$Array = function (a, i) {
        return Array.prototype.slice.call(a, i)
    }, __rest$Object = function (o, p) {
        var k = Object.keys(o), n = {};
        for (var i = 0; i < k.length; ++i) if (p.indexOf(k[i]) < 0) n[k[i]] = o[k[i]];
        return n
    };
    if (typeof importScripts !== "undefined" && /\[native code]/g.test(importScripts.toString())) {
        var __getWorkerSettings$ = function () {return null};importScripts(location.origin + "/worker-hammerhead.js");
    }
}
/*hammerhead|script|processing-header-end*/

self.addEventListener('install', (event) => {
});

self.addEventListener('activate', (event) => {

});
/*hammerhead|script|end*/
