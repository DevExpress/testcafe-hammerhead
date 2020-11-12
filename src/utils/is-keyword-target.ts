const KEYWORD_TARGETS = ['_blank', '_self', '_parent', '_top'];

export default function (value = ''): boolean {
    value = value.toLowerCase();

    return KEYWORD_TARGETS.indexOf(value) !== -1;
}
