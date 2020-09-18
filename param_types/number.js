let number = {};
number.name = 'number';
number.convert = function(value) {
    let converted = Number(value);

    return !isNaN(converted) ? converted : null;
}

module.exports.params = [number];