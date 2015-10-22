// NOTE: We can't use 'obj instanceof $' check because it depends on instance of the jQuery.
export default function isJQueryObj (obj) {
    return obj && !!obj.jquery;
}
