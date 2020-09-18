let future = {};
future.name = 'future datetime';
future.convert = function(value) {
    // Validate pattern dd/mm/yyyy hh:mm pm/am EST
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}\s\d{2}\:\d{2}\s[apAP]{1}[mM]{1}\s([A-Za-z]+)$/.test(value)) {
        return;
    }

    // Convert to numbers and stuff
    let parts = value.split(' ');
    let dateParts = parts[0].split('/').map(pt => {
        return parseInt(pt, 10);
    });
    let timeParts = parts[1].split(':').map(pt => {
        return parseInt(pt, 10);
    });

    let [day, month, year] = dateParts;
    let [hour, minute] = timeParts;

    // Adjust for leap year
    let daysInMonth = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
    if (year % 400 == 0 || (year % 100 == 0 && year % 4 == 0)) {
        daysInMonth[1] = 29;
    }

    // Invalid day
    if (day < 0 || day > daysInMonth[month]) {
        return;
    }

    if (parts[2].toLowerCase() == 'pm') {
        hour += 12;
    }

    // Invalid hour
    if (hour < 0 || hour > 24) {
        return;
    }

    // Invalid minute
    if (minute < 0 || minute > 59) {
        return;
    }

    let timeZone = parts[3];

    // Validate each part
    let today = new Date();
    if (year > today.getFullYear() + 1) {
        return;
    }

    let str = `${day} ${month} ${year} ${hour}:${minute}:00 ${timeZone}`;

    // Note, returns dates in UTC
    let dt = new Date(Date.parse(str));

    if (dt.getTime() < today.getTime()) {
        return;
    }

    dt.passedTimezone = timeZone;
    return dt;
}

module.exports.params = [future];