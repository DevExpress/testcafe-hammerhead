// @ts-ignore
let topOpenerWindow: Window = null;

export default function getTopOpenerWindow(): Window {
    if (!topOpenerWindow) {
        topOpenerWindow = window.top;

        while (topOpenerWindow.opener && topOpenerWindow !== topOpenerWindow.opener)
            topOpenerWindow = topOpenerWindow.opener.top;
    }

    return topOpenerWindow;
}
