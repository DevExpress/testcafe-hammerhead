export default function (callingContext: any, constructor: any): boolean {
    return callingContext instanceof constructor === false;
}
