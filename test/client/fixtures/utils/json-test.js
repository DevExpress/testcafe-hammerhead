var json = hammerhead.json;

module('json');

test('isSerializable', function () {
    ok(json.isSerializable({ foo: 'bar' }), 'Regular JavaScript objects can be serialized');
    notOk(json.isSerializable(document.body), 'DOM nodes cannot be serialized');
    notOk(json.isSerializable(window.noop), 'Functions cannot be serialized');
});
