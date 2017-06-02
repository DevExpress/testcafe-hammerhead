export default function (callingContext, constructor) {
    return callingContext instanceof constructor === false;
}
