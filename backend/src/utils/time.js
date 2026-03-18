const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = "Asia/Kolkata";

/**
 * Returns current time in IST
 * @returns {dayjs.Dayjs}
 */
const getISTTime = () => dayjs().tz(IST);

/**
 * Given a date, parses it and returns it in IST
 * @param {Date|string} date 
 * @returns {dayjs.Dayjs}
 */
const parseISTTime = (date) => dayjs(date).tz(IST);

/**
 * Start of day in IST for a given date or current date
 * @param {Date|string} date Default is today
 * @returns {dayjs.Dayjs}
 */
const startOfDayIST = (date) => parseISTTime(date || new Date()).startOf("day");

/**
 * End of day in IST for a given date or current date
 * @param {Date|string} date Default is today
 * @returns {dayjs.Dayjs}
 */
const endOfDayIST = (date) => parseISTTime(date || new Date()).endOf("day");

/**
 * Checks if a given checkDate is within the start and end dates inclusive based on IST
 * @param {Date|string} checkDate 
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {boolean}
 */
const isDateWithinIST = (checkDate, startDate, endDate) => {
    const check = parseISTTime(checkDate);
    const start = parseISTTime(startDate).startOf("day");
    const end = parseISTTime(endDate).endOf("day");

    return check.isSameOrAfter(start) && check.isSameOrBefore(end);
};

const validateISTPlugins = () => {
    const isSameOrAfter = require("dayjs/plugin/isSameOrAfter");
    const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
    dayjs.extend(isSameOrAfter);
    dayjs.extend(isSameOrBefore);
};

validateISTPlugins();

/**
 * Returns current IST time as a native JavaScript Date object.
 * Useful when you need to call .getHours(), .getMinutes(), etc.
 * @returns {Date}
 */
const getISTTimeAsDate = () => {
    const now = new Date();
    // Convert to IST by using toLocaleString with IST timezone, then parse back
    const istString = now.toLocaleString('en-US', { timeZone: IST });
    return new Date(istString);
};

module.exports = {
    getISTTime,
    getISTTimeAsDate,
    parseISTTime,
    startOfDayIST,
    endOfDayIST,
    isDateWithinIST,
};
