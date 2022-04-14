let topOpenerWindow = null;

export default function getTopOpenerWindow () {
    if (!topOpenerWindow) {
        topOpenerWindow = window.top;

        while (topOpenerWindow.opener && topOpenerWindow !== topOpenerWindow.opener)
            topOpenerWindow = topOpenerWindow.opener.top;
    }

    return topOpenerWindow;
}
