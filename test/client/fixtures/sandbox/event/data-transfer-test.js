var DataTransfer  = hammerhead.eventSandbox.DataTransfer;
var DragDataStore = hammerhead.eventSandbox.DragDataStore;

test('DataTransfer interface', function () {
    var dataTransfer = new DataTransfer(new DragDataStore());

    // Check instance types
    ok(dataTransfer instanceof window.DataTransfer);

    if (window.DataTransferItemList)
        ok(dataTransfer.items instanceof window.DataTransferItemList);

    strictEqual(dataTransfer.dropEffect, 'none');
    strictEqual(dataTransfer.effectAllowed, 'uninitialized');

    // Try to set not allowed values into properties
    dataTransfer.dropEffect    = 'a';
    dataTransfer.effectAllowed = 'b';

    strictEqual(dataTransfer.dropEffect, 'none');
    strictEqual(dataTransfer.effectAllowed, 'uninitialized');

    // Change properties
    dataTransfer.dropEffect    = 'copy';
    dataTransfer.effectAllowed = 'none';

    strictEqual(dataTransfer.dropEffect, 'copy');
    strictEqual(dataTransfer.effectAllowed, 'none');

    strictEqual(dataTransfer.items.length, 0);
    notOk(dataTransfer.items.hasOwnProperty('getAndHideInternalMethods'));

    strictEqual(dataTransfer.types.length, 0);
    strictEqual(dataTransfer.files.length, 0);
    notOk(dataTransfer.files.item(0));

    if (window.FileList)
        ok(dataTransfer.files instanceof window.FileList);

    // Check the setDragImage function doesn't throw
    dataTransfer.setDragImage();

    throws(function () {
        dataTransfer.getData();
    }, /Failed to execute 'getData' on 'DataTransfer'/);

    strictEqual(dataTransfer.getData('text'), '');

    throws(function () {
        dataTransfer.setData();
    }, /Failed to execute 'setData' on 'DataTransfer'/);

    throws(function () {
        dataTransfer.setData('data');
    }, /Failed to execute 'setData' on 'DataTransfer'/);
});

test('manage items', function () {
    var dataTransfer = new DataTransfer(new DragDataStore());

    // Add items
    dataTransfer.setData('text', 'data');
    dataTransfer.setData('url', 'http://example.com#abc');

    strictEqual(dataTransfer.items.length, 2);

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
    strictEqual(dataTransfer.getData('text'), 'data');
    strictEqual(dataTransfer.getData('text/plain'), 'data');
    strictEqual(dataTransfer.getData('url'), 'http://example.com#abc');

    strictEqual(dataTransfer.items[0].kind, 'string');
    strictEqual(dataTransfer.items[0].type, 'text/plain');

    strictEqual(dataTransfer.items[1].kind, 'string');
    strictEqual(dataTransfer.items[1].type, 'text/uri-list');

    throws(function () {
        dataTransfer.items.add();
    }, /Failed to execute 'add' on 'DataTransferItemList'/);

    throws(function () {
        dataTransfer.items.add('data');
    }, /Failed to execute 'add' on 'DataTransferItemList'/);

    var newItem = dataTransfer.items.add('custom', 'text/custom');

    strictEqual(newItem.type, 'text/custom');

    strictEqual(dataTransfer.items.length, 3);
    strictEqual(dataTransfer.items[2].type, 'text/custom');

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

    strictEqual(dataTransfer.items[0].type, 'text/uri-list');
    strictEqual(dataTransfer.items[1].type, 'text/custom');
    strictEqual(dataTransfer.items[2].type, 'text/plain');

    dataTransfer.items[0] = {};
    strictEqual(types[0], 'text/uri-list');
    strictEqual(dataTransfer.items[0].type, 'text/uri-list');

    // Remove items
    dataTransfer.clearData('text/uri-list');

    strictEqual(dataTransfer.items.length, 2);
    strictEqual(dataTransfer.getData('text/uri-list'), '');
    strictEqual(dataTransfer.items[1].type, 'text/plain');
    strictEqual(dataTransfer.items[2], void 0);

    enumerabled = [];

    for (prop in dataTransfer.items) {
        propInt = parseInt(prop, 10);

        if (!isNaN(propInt))
            enumerabled.push(propInt);
    }

    deepEqual(enumerabled, [0, 1]);

    dataTransfer.items.remove(0);
    strictEqual(dataTransfer.items.length, 1);
    strictEqual(dataTransfer.getData('text/custom'), '');
    strictEqual(dataTransfer.items[0].type, 'text/plain');
    strictEqual(dataTransfer.items[1], void 0);

    dataTransfer.clearData();
    strictEqual(dataTransfer.items.length, 0);
    strictEqual(dataTransfer.getData('text/plain'), '');
    strictEqual(dataTransfer.items[0], void 0);
});

asyncTest('DataTransferItem', function () {
    var dataTransfer = new DataTransfer(new DragDataStore());

    dataTransfer.setData('text/plain', 'data');

    var item = dataTransfer.items[0];

    strictEqual(item.getAsFile(), null);

    throws(function () {
        item.getAsString();
    }, /Failed to execute 'getAsString' on 'DataTransferItem'/);

    item.getAsString(function (res) {
        strictEqual(res, 'data');
        start();
    });
});

test('DragDataStore mode', function () {
    var dataStore    = new DragDataStore();
    var dataTransfer = new DataTransfer(dataStore);

    dataTransfer.setData('text/plain', 'data');
    strictEqual(dataTransfer.items.length, 1);

    dataStore.setReadOnlyMode();
    dataTransfer.setData('text/custom', 'custom');
    dataTransfer.items.add('custom', 'text/custom');
    strictEqual(dataTransfer.items.length, 1);

    dataTransfer.clearData();
    dataTransfer.items.remove(0);
    dataTransfer.items.clear();
    strictEqual(dataTransfer.items.length, 1);

    dataTransfer.dropEffect = 'copy';
    strictEqual(dataTransfer.dropEffect, 'copy');

    dataStore.setProtectedMode();
    strictEqual(dataTransfer.getData('text/custom'), '');
    strictEqual(dataTransfer.items.length, 0);
    strictEqual(dataTransfer.items[0], void 0);
    strictEqual(dataTransfer.types.length, 0);

    dataTransfer.setData('text/custom', 'custom');
    dataTransfer.items.add('custom', 'text/custom');
    strictEqual(dataTransfer.items.length, 0);
});
