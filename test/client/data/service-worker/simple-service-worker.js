self.addEventListener('install', (event) => {
});

self.addEventListener('activate', (event) => {

});

self.addEventListener('message', function (e) {
    if (e.data === 'unregister')
        self.registration.unregister();
});
