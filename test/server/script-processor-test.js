var expect                  = require('chai').expect;
var multiline               = require('multiline');
var processScript           = require('../../lib/processing/script').processScript;
var isScriptProcessed       = require('../../lib/processing/script').isScriptProcessed;
var HEADER                  = require('../../lib/processing/script/header').HEADER;
var INSTRUMENTED_PROPERTIES = require('../../lib/processing/script/instrumented').PROPERTIES;


var ACORN_UNICODE_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated acorn.
 We have patched acorn to enable it to work with unicode identifiers.

 HOW TO FIX - go to acorn and replace the following code:
 ```
 function readWord1() {
    ...
    word += escStr;
    ...
 }
 ```

 with the code below:

 ```
 function readWord1() {
    ...
    word += input.substr(tokPos-6, 6);
    ...
 }
 ```
*/
});

var ACORN_STRICT_MODE_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated acorn.
 We have patched acorn to enable it to work with ES6 syntax in strict mode.

 HOW TO FIX - go to acorn and replace the following code:
 ```
 function isUseStrict(stmt) {
     return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" &&
         stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
 }
 ```

 with the code below:

 ```
 function isUseStrict() {
    return false;
 }
 ```
*/
});

var ESOTOPE_RAW_LITERAL_PATCH_WARNING = multiline(function () {/*
 ATTENTION! If this test fails, this may happen because you have updated esotope.
 We have patched esotope to enable it to work with raw literals without additional parsing.

 HOW TO FIX - go to esotope and replace the following code:

 ```
 if (parse && extra.raw && canUseRawLiteral($expr))
    _.js += $expr.raw;
 ```

 with the code below:

 ```
 if (extra.raw && $expr.raw !== void 0)
    _.js += $expr.raw;
 ```
 */
});


function normalizeCode (code) {
    return code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, '');
}

function testProcessing (testCases) {
    testCases = Array.isArray(testCases) ? testCases : [testCases];

    testCases.forEach(function (testCase) {
        var processed = processScript(testCase.src, false);
        var actual    = normalizeCode(processed);
        var expected  = normalizeCode(testCase.expected);
        var msg       = 'Source: ' + testCase.src + '\n' +
                        'Result: ' + processed + '\n' +
                        'Expected: ' + testCase.expected + '\n';

        if (testCase.msg)
            msg += '\n\n' + testCase.msg;

        expect(actual).eql(expected, msg);
    });
}

function testPropertyProcessing (templates) {
    INSTRUMENTED_PROPERTIES.forEach(function (propName) {
        var testCases = templates.map(function (template) {
            return {
                src:      template.src.replace(/\{0\}/g, propName),
                expected: template.expected.replace(/\{0\}/g, propName)
            };
        });

        testProcessing(testCases);
    });
}

function assertHasHeader (expected, testCases) {
    testCases.forEach(function (src) {
        var processed = processScript(src, true);
        var hasHeader = processed.indexOf(HEADER) > -1;
        var msg       = 'Source: ' + src + '\n';

        expect(hasHeader).eql(expected, msg);
    });
}

describe('Script processor', function () {
    describe('Processing header', function () {
        it('Should add processing header', function () {
            assertHasHeader(true, [
                'var a = 42;',
                '[]; var a = 42; []',
                '{ var a = 42; }'
            ]);
        });

        it('Should not add processing header for the data script', function () {
            assertHasHeader(false, [
                '[1, 2, 3]',
                '{ a: 42 }'
            ]);
        });

        it('Should not add processing header twice', function () {
            var src        = 'var a = 42;';
            var processed1 = processScript(src, true);
            var processed2 = processScript(processed1, true);

            expect(normalizeCode(processed1)).eql(normalizeCode(processed2));
        });
    });

    it('Should determine if script was processed', function () {
        var src       = '//comment\n var temp = 0; \n var host = location.host; \n temp = 1; \n // comment';
        var processed = processScript(src, false);

        expect(isScriptProcessed(src)).to.be.false;
        expect(isScriptProcessed(processed)).to.be.true;
    });

    it('Should process location getters and setters', function () {
        testProcessing([
            { src: 'var location = value', expected: 'var location = value' },
            {
                src:      'location = value',
                expected: '(function() { return __set$Loc(location, value) || (location = value); }.apply(this))'
            },
            {
                src:      '{ location: 123 }',
                expected: '{ location: 123 }'
            },
            { src: '[ location ]', expected: '[ __get$Loc(location) ]' },
            { src: 'var loc = location', expected: 'var loc = __get$Loc(location)' },
            { src: 'location ? true : false', expected: '__get$Loc(location) ? true : false' },
            { src: 'location + ""', expected: '__get$Loc(location) + ""' },
            { src: 'location.hostname', expected: '__get$(__get$Loc(location), "hostname")' },
            { src: 'location["hostname"]', expected: '__get$(__get$Loc(location), "hostname")' },
            { src: 'location[hostname]', expected: '__get$(__get$Loc(location), hostname)' },
            { src: 'location.href', expected: '__get$(__get$Loc(location), "href")' },
            { src: 'var func = function(location){}', expected: 'var func = function(location){}' },
            { src: 'function func(location){}', expected: 'function func(location){}' },
            { src: 'location[someProperty]', expected: '__get$(__get$Loc(location), someProperty)' },
            { src: 'location.host.toString()', expected: '__get$(__get$Loc(location), "host").toString()' },
            { src: 'location[host].toString()', expected: '__get$(__get$Loc(location), host).toString()' },
            {
                src:      'temp = { location: value, value: location }',
                expected: 'temp = { location: value, value: __get$Loc(location) }'
            },

            { src: '--location', expected: '--location' },
            { src: 'location--', expected: 'location--' },
            { src: 'location++', expected: 'location++' },
            { src: '++location', expected: '++location' },

            {
                src:      'location+=value',
                expected: '(function(){return __set$Loc(location,__get$Loc(location)+value)||' +
                          '(location=__get$Loc(location)+value);}.apply(this))'
            },
            {
                src:      'location+=location+value',
                expected: '(function(){return __set$Loc(location,__get$Loc(location)+(__get$Loc(location)+value))||' +
                          '(location=__get$Loc(location)+(__get$Loc(location)+value));}.apply(this))'
            },
            {
                src:      'location.hostname+=value',
                expected: '__set$(__get$Loc(location), "hostname", __get$(__get$Loc(location), "hostname") + value)'
            },
            {
                src:      'location.href+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value)'
            },
            {
                src:      'location[hostname]+=value',
                expected: '__set$(__get$Loc(location), hostname, __get$(__get$Loc(location), hostname) + value)'
            },
            {
                src:      'location["hostname"]+=value',
                expected: '__set$(__get$Loc(location), "hostname", __get$(__get$Loc(location), "hostname") + value)'
            },
            {
                src:      'location["href"]+=value',
                expected: '__set$(__get$Loc(location), "href", __get$(__get$Loc(location), "href") + value) '
            },

            {
                src: 'location-=value;location*=value;location/=value;' +
                     'location>>=value;location<<=value;location>>>=value;' +
                     'location&=value;location|=value;location^=value',

                expected: 'location-=value;location*=value;location/=value;' +
                          'location>>=value;location<<=value;location>>>=value;' +
                          'location&=value;location|=value;location^=value'
            }
        ]);
    });

    it('Should expand concat operator', function () {
        testProcessing([
            { src: 'prop += 1', expected: 'prop = prop + 1' },
            { src: 'prop += 2 + prop + 1', expected: 'prop = prop + (2 + prop + 1)' }
        ]);
    });

    it('Should process function body in Function ctor', function () {
        testProcessing([
            { src: 'new Function();', expected: 'new Function();' },
            { src: 'new Function(\'return a.href;\');', expected: 'new Function(__proc$Script(\'return a.href;\'));' },
            { src: 'new Function("x", "y", body);', expected: 'new Function("x", "y", __proc$Script(body));' }
        ]);
    });

    it('Should add a space before the replacement string', function () {
        var processed = processScript('if(true){;}else"0"[s]', false);

        expect(processed).eql('if(true){;}else __get$("0",s)');
    });

    it('Should process a "new" expression if its body contains processed nodes', function () {
        testPropertyProcessing([
            { src: 'new a.{0}.b()', expected: 'new (__get$(a,"{0}")).b()' },
            {
                src:      'new function() { a.{0};a.{0};}();',
                expected: 'new function() {__get$(a,"{0}");__get$(a,"{0}");}();'
            },
            {
                src:      'new (function() { eval("");a.{0};})();',
                expected: 'new function() {eval(__proc$Script(""));__get$(a,"{0}");}();'
            },
            {
                src:      'new a(function() { b.{0}; new ok(b.{0}); })',
                expected: 'new a(function() { __get$(b,"{0}"); new ok(__get$(b,"{0}")); })'
            },
            { src: 'new a.{0}.b(c.{0})', expected: 'new (__get$(a,"{0}")).b(__get$(c,"{0}"))' },
            { src: 'func(new a.{0}.func())', expected: 'func(new (__get$(a,"{0}")).func())' }
        ]);
    });

    it('Should process properties', function () {
        testPropertyProcessing([
            { src: 'switch(s){case a.{0}:b.{0}}', expected: 'switch(s){case __get$(a,"{0}"): __get$(b,"{0}")}' },
            { src: 'function {0}(){}', expected: 'function {0}(){}' },
            { src: 'obj.{0}', expected: '__get$(obj, "{0}")' },
            { src: 'obj.{0} = value', expected: '__set$(obj, "{0}", value)' },
            { src: 'obj.{0}.subProp', expected: '__get$(obj, "{0}").subProp' },
            { src: 'obj.{0}.{0} = value', expected: '__set$(__get$(obj, "{0}"),"{0}", value)' },
            { src: 'delete obj.{0}', expected: 'delete obj.{0}' },
            { src: 'obj.{0}.method()', expected: '__get$(obj, "{0}").method()' },
            { src: 'new (obj.{0})()', expected: 'new (obj.{0})()' },
            { src: '--obj.{0}', expected: '--obj.{0}' },
            { src: 'obj.{0}--', expected: 'obj.{0}--' },
            { src: 'obj.{0}++', expected: 'obj.{0}++' },
            { src: '++obj.{0}', expected: '++obj.{0}' },
            { src: 'obj.{0}()', expected: 'obj.{0}()' },

            { src: 'obj.{0}+=value', expected: '__set$(obj, "{0}", __get$(obj, "{0}")+value)' },
            {
                src:      'obj.{0}+=obj.{0}+value',
                expected: '__set$(obj,"{0}",__get$(obj, "{0}")+(__get$(obj, "{0}")+value))'
            },
            { src: 'obj.{0}.field+=value', expected: '__get$(obj, "{0}").field = __get$(obj, "{0}").field + value' },
            {
                src:      'obj.{0}[field]+=value',
                expected: '__set$(__get$(obj,"{0}"),field,__get$(__get$(obj,"{0}"), field) + value)'
            },
            {
                src:      'obj.{0}["field"]+=value',
                expected: '__get$(obj,"{0}")["field"]=__get$(obj,"{0}")["field"] + value'
            },
            {
                src:      'obj.{0}["href"]+=value',
                expected: '__set$(__get$(obj,"{0}"),"href", __get$(__get$(obj,"{0}"), "href") + value)'
            },
            { src: 'result = $el[0].{0}', expected: 'result = __get$($el[0], "{0}")' },
            { src: 'obj.{0} = value, obj1 = value', expected: '__set$(obj,"{0}",value), obj1 = value' },
            { src: '{}script.{0} += ""', expected: '{} __set$(script, "{0}", __get$(script,"{0}")+"")' },

            {
                src: 'obj.{0}-=value;obj.{0}*=value;obj.{0}/=value;' +
                     'obj.{0}>>=value;obj.{0}<<=value;obj.{0}>>>=value;' +
                     'obj.{0}&=value;obj.{0}|=value;obj.{0}^=value',

                expected: 'obj.{0}-=value;obj.{0}*=value;obj.{0}/=value;' +
                          'obj.{0}>>=value;obj.{0}<<=value;obj.{0}>>>=value;' +
                          'obj.{0}&=value;obj.{0}|=value;obj.{0}^=value'
            }
        ]);
    });

    it('Should process computed properties', function () {
        testPropertyProcessing([
            { src: 'var temp = "location"; obj[t]', expected: 'var temp = "location";__get$(obj, t)' },
            {
                src:      'obj[prop1]["prop2"].{0}.{0} = value',
                expected: '__set$(__get$(__get$(obj, prop1)["prop2"], "{0}"),"{0}", value)'
            },
            { src: 'obj[someProperty] = value', expected: '__set$(obj, someProperty, value)' },
            { src: 'delete obj[{0}]', expected: 'delete obj[{0}]' },
            { src: 'new (obj["{0}"])()', expected: 'new (obj["{0}"])()' },

            { src: '--obj[{0}]', expected: '--obj[{0}]' },
            { src: 'obj[{0}]--', expected: 'obj[{0}]--' },
            { src: 'obj[0]++', expected: 'obj[0]++' },
            { src: '++obj[0]', expected: '++obj[0]' },
            { src: 'obj[someProperty](1,2,3)', expected: '__call$(obj,someProperty,[1,2,3])' },

            {
                src: 'obj[{0}]-=value;obj[{0}]*=value;obj[{0}]/=value;' +
                     'obj[{0}]>>=value;obj[{0}]<<=value;obj[{0}]>>>=value;' +
                     'obj[{0}]&=value;obj[{0}]|=value;obj[{0}]^=value',

                expected: 'obj[{0}]-=value;obj[{0}]*=value;obj[{0}]/=value;' +
                          'obj[{0}]>>=value;obj[{0}]<<=value;obj[{0}]>>>=value;' +
                          'obj[{0}]&=value;obj[{0}]|=value;obj[{0}]^=value'
            }
        ]);
    });

    it('Should process object expressions', function () {
        testProcessing({
            src:      '{ location: value, value: location, src: src }',
            expected: '{ location: value, value: __get$Loc(location), src: src }'
        });
    });

    it('Should keep raw literals', function () {
        testProcessing({
            src:      'obj["\\u003c/script>"]=location',
            expected: 'obj["\\u003c/script>"]=__get$Loc(location)',
            msg:      ESOTOPE_RAW_LITERAL_PATCH_WARNING
        });
    });

    it('Should process eval()', function () {
        testProcessing([
            { src: 'eval(script)', expected: 'eval(__proc$Script(script))' },
            { src: 'eval("script")', expected: 'eval(__proc$Script("script"))' },
            { src: 'window.eval(script)', expected: 'window.eval(__proc$Script(script))' },
            { src: 'window["eval"](script)', expected: 'window["eval"](__proc$Script(script))' },

            { src: 'eval.call(window, script)', expected: 'eval.call(window, __proc$Script(script))' },
            { src: 'eval.call(window, "script")', expected: 'eval.call(window, __proc$Script("script"))' },
            { src: 'window.eval.call(window, script)', expected: 'window.eval.call(window, __proc$Script(script))' },
            {
                src:      'window["eval"].call(window, script)',
                expected: 'window["eval"].call(window, __proc$Script(script))'
            },

            { src: 'eval.apply(window, [script])', expected: 'eval.apply(window, __proc$Script([script], true))' },
            { src: 'eval.apply(window, ["script"])', expected: 'eval.apply(window, __proc$Script(["script"], true))' },
            { src: 'eval.apply(window, args)', expected: 'eval.apply(window, __proc$Script(args, true))' },
            {
                src:      'window.eval.apply(window, [script])',
                expected: 'window.eval.apply(window, __proc$Script([script], true))'
            },
            {
                src:      'window["eval"].apply(window, [script])',
                expected: 'window["eval"].apply(window, __proc$Script([script], true))'
            },
            {
                src:      'var a = eval, b = window.eval, c = window["eval"];',
                expected: 'var a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);'
            },
            {
                src:      'a = eval, b = window.eval, c = window["eval"];',
                expected: 'a = __get$Eval(eval), b = __get$Eval(window.eval), c = __get$Eval(window["eval"]);'
            },
            {
                src:      '{a: eval, b:window.eval, c: window["eval"]}',
                expected: '{a: __get$Eval(eval), b:__get$Eval(window.eval), c: __get$Eval(window["eval"])}'
            },
            {
                src:      '(function() {return eval;}, function(){return window.eval;}, function(){return window["eval"]})',
                expected: '(function() {return __get$Eval(eval);}, function(){return __get$Eval(window.eval);}, function(){return __get$Eval(window["eval"])})'
            },
            {
                src:      '(function a (eval) {}); a(eval, window.eval, window["eval"]);',
                expected: '(function a (eval) {}); a(__get$Eval(eval), __get$Eval(window.eval), __get$Eval(window["eval"]));'
            },
            {
                src:      '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");',
                expected: '__get$Eval(eval)("");__get$Eval(window.eval)("");__get$Eval(window["eval"])("");'
            },
            {
                src:      'eval++; eval--; ++eval; --eval;',
                expected: 'eval++; eval--; ++eval; --eval;'
            },
            {
                src:      'window.eval = 1; window["eval"] = 1;',
                expected: 'window.eval = 1; window["eval"] = 1;'
            },
            {
                src:      'var ob = {eval : 1};',
                expected: 'var ob = {eval : 1};'
            },

            {
                src:      'var eval = value; eval = newValue;',
                expected: 'var eval = value; eval = newValue;'
            },
            {
                src:      'window.eval.property',
                expected: 'window.eval.property'
            }
        ]);
    });

    it('Should process storages', function () {
        testProcessing([
            {
                src:      'function localStorage(){}; function sessionStorage() {};',
                expected: 'function localStorage(){}; function sessionStorage() {};'
            },
            { src: 'localStorage()', expected: '__get$Storage(localStorage)()' },
            { src: 'window.sessionStorage()', expected: 'window.sessionStorage()' },
            { src: 'window["localStorage"]()', expected: 'window["localStorage"]()' },
            {
                src:      'var a = localStorage, b = window.localStorage, c = window["localStorage"];',
                expected: 'var a = __get$Storage(localStorage), b = __get$(window,"localStorage"), c = __get$(window,"localStorage");'
            },
            {
                src:      'a = sessionStorage, b = window.sessionStorage, c = window["sessionStorage"];',
                expected: 'a = __get$Storage(sessionStorage), b =__get$(window,"sessionStorage"), c =__get$(window,"sessionStorage");'
            },
            {
                src:      '{a: localStorage, b:window.localStorage, c: window["localStorage"]}',
                expected: '{a: __get$Storage(localStorage), b: __get$(window,"localStorage"), c:  __get$(window,"localStorage")}'
            },
            {
                src:      '(function() {return sessionStorage;}, function(){return window.sessionStorage;}, function(){return window["sessionStorage"]})',
                expected: '(function() {return __get$Storage(sessionStorage);}, function(){return __get$(window,"sessionStorage");}, function(){return __get$(window,"sessionStorage")})'
            },
            {
                src:      '(function a (localStorage) {}); a(localStorage, window.localStorage, window["localStorage"]);',
                expected: '(function a (localStorage) {}); a(__get$Storage(localStorage),__get$(window,"localStorage"), __get$(window,"localStorage"));'
            },
            {
                src:      '__get$Storage(sessionStorage).getItem("");__get$(window,"localStorage").getItem("");',
                expected: '__get$Storage(sessionStorage).getItem("");__get$(window,"localStorage").getItem("");'
            },
            {
                src:      'sessionStorage++; sessionStorage--; ++localStorage; --localStorage;',
                expected: 'sessionStorage++; sessionStorage--; ++localStorage; --localStorage;'
            },
            {
                src:      'var ob = {localStorage : 1};',
                expected: 'var ob = {localStorage : 1};'
            },

            {
                src:      'var sessionStorage = value; sessionStorage = newValue;',
                expected: 'var sessionStorage = value; sessionStorage = newValue;'
            },
            {
                src:      'window.localStorage.key; window["localStorage"].key',
                expected: '__get$(window,"localStorage").key;__get$(window,"localStorage").key'
            }
        ]);
    });

    it('Should process window.postMessage()', function () {
        testProcessing([
            { src: 'window.postMessage("", "")', expected: '__call$(window, "postMessage", ["", ""])' },
            { src: 'window["postMessage"]("", "")', expected: '__call$(window, "postMessage", ["", ""])' },
            { src: 'window[postMessage]("", "")', expected: '__call$(window, postMessage, ["", ""])' },
            { src: 'window["some"]("", "")', expected: 'window["some"]("", "")' },
            { src: 'window.some.("", "")', expected: 'window.some.("", "")' }
        ]);
    });

    it('Should process for..in iteration', function () {
        testProcessing([
            { src: 'for(obj.prop in src){}', expected: 'for(var __set$temp in src){obj.prop = __set$temp;}' },
            { src: 'for(obj["prop"] in src){}', expected: 'for(var __set$temp in src){obj["prop"] = __set$temp;}' },
            { src: 'for(obj[i++] in src){}', expected: 'for(var __set$temp in src){__set$(obj, i++, __set$temp);}' },
            { src: 'for(obj.href in src){}', expected: 'for(var __set$temp in src){__set$(obj, "href", __set$temp);}' },
            {
                src:      'for(obj["href"] in src){}',
                expected: 'for(var __set$temp in src){__set$(obj, "href", __set$temp);}'
            }
        ]);
    });

    it('Should keep unicode identifiers', function () {
        testProcessing({
            src:      '({\\u00c0:"value"})[value]',
            expected: '__get$({\\u00c0:"value"}, value)',
            msg:      ACORN_UNICODE_PATCH_WARNING
        });
    });

    it('Should allow ES6 syntax in strict mode', function () {
        testProcessing([
            {
                src:      '"use strict";var let=0;obj.src;',
                expected: '"use strict";var let=0;__get$(obj,"src");',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING
            },
            {
                src:      '"use strict";var obj={yield:function(){}};obj.src;',
                expected: '"use strict";var obj={yield:function(){}};__get$(obj, "src");',
                msg:      ACORN_STRICT_MODE_PATCH_WARNING
            }
        ]);
    });

    it('Should ignore HTML comments', function () {
        testProcessing([
            { src: 'a[i];\n<!-- comment -->', expected: '__get$(a, i);' },
            { src: '<!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: ' <!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: '\n<!-- comment -->\n a[i];', expected: '__get$(a, i);' },
            { src: '<!-- comment1 -->\n<!-- comment2 -->\n a[i];', expected: '__get$(a, i);' },
            { src: '<!-- comment1 -->\n a[i];\n<!-- comment2 -->', expected: '__get$(a, i);' },
            {
                src:      'var t = "<!-- comment1 -->\\n";\na[i];',
                expected: 'var t = "<!-- comment1 -->\\n";\n__get$(a, i);'
            }
        ]);
    });

    describe('Regression', function () {
        it('Should leave comments unchanged (T170848)', function () {
            testProcessing({
                src:      'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } a.src=function(){};',
                expected: 'function test(){ \n /* \n line1 \n line2 \n line3 \n */ } __set$(a,"src",function(){});'
            });
        });

        it('Should process content in block statement (T209250)', function () {
            testProcessing({
                src:      '{ (function() { a.src = "success"; })(); }',
                expected: '{ (function() { __set$(a, "src", "success"); })(); }'
            });
        });

        it('Should keep script content inside HTML comments (T226589)', function () {
            testProcessing({
                src: 'document.writeln("<!--test123-->");\n' +
                     '<!--Begin -->\n' +
                     '<!--\n' +
                     'client = "42";\n' +
                     '/* yo yo */\n' +
                     'slot = "43";\n' +
                     'width = 300;\n' +
                     'e = eval;\n' +
                     'height = 250;\n' +
                     '//-->\n\n' +
                     '<!--End -->\n' +
                     'document.writeln("var t = 1;");\n' +
                     'document.writeln("t = 2;");\n' +
                     'document.close();\n',

                expected: 'document.writeln("<!--test123-->");' +
                          'client = "42";' +
                          '/* yo yo */\n' +
                          'slot = "43";' +
                          'width = 300;' +
                          'e = __get$Eval(eval);' +
                          'height = 250;' +
                          '//-->\n\n' +
                          'document.writeln("var t = 1;");' +
                          'document.writeln("t = 2;");' +
                          'document.close();'
            });
        });

        it('Should handle malformed HTML comments (T239244)', function () {
            testProcessing({
                src: '<!-- rai_mm_tools -->\n' +
                     '<!--\n' +
                     'function test(theURL,winName,features) { //v2.0\n' +
                     '   a[i];\n' +
                     '}\n' +
                     '//-->',

                expected: 'function test(theURL,winName,features) { //v2.0\n' +
                          '   __get$(a, i);\n' +
                          '}\n' +
                          '//-->'
            });
        });

        it('Should handle malformed closing HTML comments (health monitor)', function () {
            testProcessing([
                {
                    src: '<!--\n' +
                         'dn="SIDEX.RU";\n' +
                         'a[i]\n' +
                         '// -->',

                    expected: 'dn="SIDEX.RU";\n' +
                              '__get$(a, i)\n' +
                              '// -->'
                },
                {
                    src:      '<!--\n' + 'dn="SIDEX.RU";\n // -->',
                    expected: '<!--\n' + 'dn="SIDEX.RU";\n // -->'
                }
            ]);
        });

        it('Should keep line after open HTML comments (health monitor)', function () {
            testProcessing({
                src: '<!--\n' +
                     'var rdm0 = "";\n' +
                     'var rdm1 = "";\n' +
                     'a[i];' +
                     '//-->',

                expected: 'var rdm0 = "";\n' +
                          'var rdm1 = "";\n' +
                          '__get$(a, i);' +
                          '//-->'
            });
        });

        it('Should not throw parser exceptions', function () {
            var testParser = function (scriptStr) {
                scriptStr += '\nx.src';

                expect(processScript(scriptStr, false).indexOf('x.src') === -1).equal(true);
            };

            testParser('function a(){function b(){}/k/;}'); // GH-591
            testParser('function s(){do var x = 9; while(false)return}'); // GH-567
        });
    });
});
