var isIE11        = hammerhead.utils.browser.isIE11;
var DataTransfer  = hammerhead.eventSandbox.DataTransfer;
var DragDataStore = hammerhead.eventSandbox.DragDataStore;

test('DataTransfer interface', function () {
    var dataTransfer = new DataTransfer(new DragDataStore());

    // Check instance types
    ok(dataTransfer instanceof window.DataTransfer);

    if (window.DataTransferItemList)
        ok(dataTransfer.items instanceof window.DataTransferItemList);

    equal(dataTransfer.dropEffect, 'none');
    equal(dataTransfer.effectAllowed, 'uninitialized');

    // Try to set not allowed values into properties
    dataTransfer.dropEffect    = 'a';
    dataTransfer.effectAllowed = 'b';

    equal(dataTransfer.dropEffect, 'none');
    equal(dataTransfer.effectAllowed, 'uninitialized');

    // Change properties
    dataTransfer.dropEffect    = 'copy';
    dataTransfer.effectAllowed = 'none';

    equal(dataTransfer.dropEffect, 'copy');
    equal(dataTransfer.effectAllowed, 'none');

    if (isIE11)
        notOk(dataTransfer.items);
    else
        equal(dataTransfer.items.length, 0);

    equal(dataTransfer.types.length, 0);
    equal(dataTransfer.files.length, 0);

    // Check the setDragImage function doesn't throw
    if (!isIE11)
        dataTransfer.setDragImage();

    throws(function () {
        dataTransfer.getData();
    }, /Failed to execute 'getData' on 'DataTransfer'/);

    equal(dataTransfer.getData('text'), '');

    throws(function () {
        dataTransfer.setData();
    }, /Failed to execute 'setData' on 'DataTransfer'/);

    throws(function () {
        dataTransfer.setData('data');
    }, /Failed to execute 'setData' on 'DataTransfer'/);
});

if (isIE11) {
    // NOTE: ie11 has limited support of DataTransfer
    test('Manage items', function () {
        var dataTransfer = new DataTransfer(new DragDataStore());

        // Add items
        dataTransfer.setData('text', 'data');
        dataTransfer.setData('url', 'http://example.com#abc');

        var types = dataTransfer.types;

        deepEqual(types, ['text/plain', 'text/uri-list']);

        equal(dataTransfer.getData('text'), 'data');
        equal(dataTransfer.getData('text/plain'), 'data');
        equal(dataTransfer.getData('url'), 'http://example.com#abc');

        // Replace item
        dataTransfer.setData('text/plain', 'new data');

        types = dataTransfer.types;

        deepEqual(types, ['text/uri-list', 'text/plain']);
        equal(dataTransfer.getData('text/plain'), 'new data');

        // Remove items
        dataTransfer.clearData('text/uri-list');

        equal(dataTransfer.getData('text/uri-list'), '');
    });
}
else {
    test('Manage items', function () {
        var dataTransfer = new DataTransfer(new DragDataStore());

        // Add items
        dataTransfer.setData('text', 'data');
        dataTransfer.setData('url', 'http://example.com#abc');

        equal(dataTransfer.items.length, 2);

        if (window.DataTransferItem)
            ok(dataTransfer.items[0] instanceof window.DataTransferItem);

        var types = dataTransfer.types;

        deepEqual(types, ['text/plain', 'text/uri-list']);

        var enumerabled = [];
        var prop        = null;
        var propInt     = null;

        for (prop in dataTransfer.items) {
            propInt = parseInt(prop, 10);

            if (!isNaN(propInt))
                enumerabled.push(propInt);
        }

        deepEqual(enumerabled, [0, 1]);
        equal(dataTransfer.getData('text'), 'data');
        equal(dataTransfer.getData('text/plain'), 'data');
        equal(dataTransfer.getData('url'), 'http://example.com#abc');

        equal(dataTransfer.items[0].kind, 'string');
        equal(dataTransfer.items[0].type, 'text/plain');

        equal(dataTransfer.items[1].kind, 'string');
        equal(dataTransfer.items[1].type, 'text/uri-list');

        throws(function () {
            dataTransfer.items.add();
        }, /Failed to execute 'add' on 'DataTransferItemList'/);

        throws(function () {
            dataTransfer.items.add('data');
        }, /Failed to execute 'add' on 'DataTransferItemList'/);

        var newItem = dataTransfer.items.add('custom', 'text/custom');

        equal(newItem.type, 'text/custom');

        equal(dataTransfer.items.length, 3);
        equal(dataTransfer.items[2].type, 'text/custom');

        enumerabled = [];

        for (prop in dataTransfer.items) {
            propInt = parseInt(prop, 10);

            if (!isNaN(propInt))
                enumerabled.push(propInt);
        }

        deepEqual(enumerabled, [0, 1, 2]);

        throws(function () {
            dataTransfer.items.add('new data', 'text/plain');
        }, /Failed to execute 'add' on 'DataTransferItemList': An item already exists for type 'text\/plain'./);

        // Replace item
        dataTransfer.setData('text/plain', 'new data');

        types = dataTransfer.types;

        deepEqual(types, ['text/uri-list', 'text/custom', 'text/plain']);

        equal(dataTransfer.items[0].type, 'text/uri-list');
        equal(dataTransfer.items[1].type, 'text/custom');
        equal(dataTransfer.items[2].type, 'text/plain');

        dataTransfer.items[0] = {};
        equal(types[0], 'text/uri-list');
        equal(dataTransfer.items[0].type, 'text/uri-list');

        // Remove items
        dataTransfer.clearData('text/uri-list');

        equal(dataTransfer.items.length, 2);
        equal(dataTransfer.getData('text/uri-list'), '');
        equal(dataTransfer.items[1].type, 'text/plain');
        equal(dataTransfer.items[2], void 0);

        enumerabled = [];

        for (prop in dataTransfer.items) {
            propInt = parseInt(prop, 10);

            if (!isNaN(propInt))
                enumerabled.push(propInt);
        }

        deepEqual(enumerabled, [0, 1]);

        dataTransfer.items.remove(0);
        equal(dataTransfer.items.length, 1);
        equal(dataTransfer.getData('text/custom'), '');
        equal(dataTransfer.items[0].type, 'text/plain');
        equal(dataTransfer.items[1], void 0);

        dataTransfer.clearData();
        equal(dataTransfer.items.length, 0);
        equal(dataTransfer.getData('text/plain'), '');
        equal(dataTransfer.items[0], void 0);
    });

    asyncTest('DataTransferItem', function () {
        var dataTransfer = new DataTransfer(new DragDataStore());

        dataTransfer.setData('text/plain', 'data');

        var item = dataTransfer.items[0];

        equal(item.getAsFile(), null);

        throws(function () {
            item.getAsString();
        }, /Failed to execute 'getAsString' on 'DataTransferItem'/);

        item.getAsString(function (res) {
            equal(res, 'data');
            start();
        });
    });

    test('DataStore mode', function () {
        var dataStore    = new DragDataStore();
        var dataTransfer = new DataTransfer(dataStore);

        dataTransfer.setData('text/plain', 'data');
        equal(dataTransfer.items.length, 1);

        dataStore.setReadOnlyMode();
        dataTransfer.setData('text/custom', 'custom');
        dataTransfer.items.add('custom', 'text/custom');
        equal(dataTransfer.items.length, 1);

        dataTransfer.clearData();
        dataTransfer.items.remove(0);
        dataTransfer.items.clear();
        equal(dataTransfer.items.length, 1);

        dataTransfer.dropEffect = 'copy';
        equal(dataTransfer.dropEffect, 'copy');

        dataStore.setProtectedMode();
        equal(dataTransfer.getData('text/custom'), '');
        equal(dataTransfer.items.length, 0);
        equal(dataTransfer.items[0], void 0);
        equal(dataTransfer.types.length, 0);

        dataTransfer.setData('text/custom', 'custom');
        dataTransfer.items.add('custom', 'text/custom');
        equal(dataTransfer.items.length, 0);
    });
}
