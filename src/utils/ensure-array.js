export default function (value) {
    return Array.isArray(value) ? value : [value];
}
