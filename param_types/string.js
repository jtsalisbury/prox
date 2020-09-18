let string = {};
string.name = 'string';
string.convert = function(value) {
    if (value) {
        return value.replace(/[|`;$%@"(),]/g, "");
    }
}

module.exports.params = [string];