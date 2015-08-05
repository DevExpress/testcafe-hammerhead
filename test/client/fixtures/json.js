var json = Hammerhead.get('./json');

test('JSON.isSerializable', function () {
    $('<div id="testDiv">').appendTo('body');

    var $testDiv = $('#testDiv');

    var obj1 = {
        prop1: 'someStr',
        prop2: {
            jqueryObj: $testDiv
        }
    };

    var obj2 = {
        prop1: 'someStr',
        prop2: [$testDiv[0], '123']
    };

    var obj3 = {
        prop1: function () {
            /* eslint-disable no-alert */
            alert('1');
            /* eslint-enable no-alert */
        }
    };

    var obj4 = {
        prop1: 1,
        prop2: {
            prop3: [
                new Date(),
                false
            ]
        }
    };

    ok(!json.isSerializable(obj1));
    ok(!json.isSerializable(obj2));
    ok(!json.isSerializable(obj3));
    ok(json.isSerializable(obj4));
});
