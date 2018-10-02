# testcafe-hammerhead

## Core Concepts

`testcafe-hammerhead` is a URL-rewriting proxy. This means that it rewrites all properties of the appropriate JavaScript objects that contain a URL value (`Location`, `HTMLLinkElement.href`, etc). You can see it if you open a proxied page, invoke the browser's DevTools and inspect any element.

In addition, the proxied web page does not know that it is opened under a proxy. The proxy intercepts access attempts to all URL-containing properties and provides the original values.

## First look
1. Install the Hammerhead proxy (`npm install testcafe-hammerhead --save`), 
2. Build it (`gulp run build`)
3. Run the [Hammerhead playground](https://github.com/DevExpress/testcafe-hammerhead/blob/master/test/playground/server.js) (`npm run http-playground`) to see our proxy in action.

This opens a playground page where you can specify a webpage to proxy. Enter the page URL and hit **Proxy!**.

## Features

* HTTP/HTTPS requests
* WebSockets, EventSource
* file upload
* request events (`onRequest`, `onResponse`)
* bypass requests
* custom UI on web page

##  Reporting Issues and Contributing

* if your website works differently with and without a proxy, create an issue.
* if you find a problem, please provide a public link to your website or create a simple example to reproduce it.
* all PRs with bug fixes should contain tests (there may be rare exceptions)

[![Build Status](https://travis-ci.org/DevExpress/testcafe-hammerhead.svg)](https://travis-ci.org/DevExpress/testcafe-hammerhead)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/testcafebot.svg)](https://saucelabs.com/u/testcafebot)

[![Health Monitor](https://testcafe-hhhm.devexpress.com/badge/last-commit.svg)](https://testcafe-hhhm.devexpress.com)


