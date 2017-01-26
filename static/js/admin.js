var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */
    var tcNavToday;
    var tcNavRange;
    var tcNavTotal;

    var dbStatus;
    var dbSave;

    /* local variables */
    var focusDate;

    /* public variables */
    // all values provided by server
    tc.slotIncrement;
    tc.initialDate;
    tc.lockDate = 1483228800; // TODO: provided by server


    tc.init = function () {
        dbStatus = document.getElementById("db-status");
        dbSave = document.getElementById("database-save");

        tcNavToday = document.getElementById("tc-nav-today");
        tcNavRange = document.getElementById("tc-nav-range");
        tcNavTotal = document.getElementById("tc-nav-total");

        tc.currentWeek();
    }

    function getFromDatabase() {}
    
    function navUpdate() {
        tcNavToday.disabled = focusDate.isSame(tc.initialDate, "day");
        // TODO: Need to define 2-week pay period given config day offset?
        tcNavRange.textContent = moment(focusDate).startOf("week").format("MMM D") + " – " + moment(focusDate).endOf("week").format("D, YYYY");
    }

    tc.currentWeek = function () {
        focusDate = moment(tc.initialDate);
        navUpdate();
        getFromDatabase();
    }

    tc.prevWeek = function () {
        focusDate.subtract(1, "week");
        navUpdate();
        getFromDatabase();
    }

    tc.nextWeek = function () {
        focusDate.add(1, "week");
        navUpdate();
        getFromDatabase();
    }

    return tc;
})();
// Justin Carlson