module.exports = {};

module.exports.sendMessage = function(string, target) {
    target.send(string, { split: true });
}