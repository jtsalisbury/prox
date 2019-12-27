let request = require('request');
let utils = {};

utils.HTTPGet = async function(url, headers) {
    return new Promise((resolve, reject) => {
        request.get({
            url: url,
            rejectUnauthorized: false,
            headers: headers
        }, function(err, res, body) {
            if (err) {
                reject(err);
                return;
            }

            resolve(JSON.parse(body));
        });
    });
};

utils.HTTPPost = async function(url, payload) {
    return new Promise((resolve, reject) => {
        request.post(url, {
            rejectUnauthorized: false,
            json: payload
        }, function(err, res, body) {
            if (err) {
                reject(err);
                return;
            }

            resolve(body);
        });
    });
};

utils.parseLine = function (line) {
    let index = 0;
    let parts = [];
    let quotes = {
        "\'": true,
        '\"': true
    }
    while (index !== null) {
        let curChar = line[index];
        if (!curChar) {
            break;
        }

        if (curChar === ' ') {
            index++;
            continue;
        }

        if (quotes[curChar]) {
            let closingQuoteIndex = line.indexOf(curChar, index + 1);
            let charsBetween = closingQuoteIndex - index - 1;
            let quotedString = line.substr(index + 1, closingQuoteIndex !== -1 ? charsBetween : undefined);
            parts.push(quotedString);

            if (closingQuoteIndex === -1) {
                break;
            }

            index = closingQuoteIndex + 1;
        } else {
            let nextSpaceIndex = line.indexOf(' ', index + 1);
            let charsBetween = nextSpaceIndex - index;
            let word = line.substr(index, nextSpaceIndex !== -1 ? charsBetween : undefined) 
            parts.push(word);
            
            if (nextSpaceIndex === -1) {
                break;
            }
            
            index = nextSpaceIndex + 1;
        }
    }

    return parts;
};

module.exports = utils;