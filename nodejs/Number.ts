/**
 * Number.prototype.format(n, x)
 * 
 * @param integer n: length of decimal
 * @param integer x: length of sections
 */
Number.prototype['format'] = function (decimalLength, sectionLength) {
    var re = '\\d(?=(\\d{' + (sectionLength || 3) + '})+' + (decimalLength > 0 ? '\\.' : '$') + ')';
    return this.toFixed(Math.max(0, ~~decimalLength)).replace(new RegExp(re, 'g'), '$&,');
};