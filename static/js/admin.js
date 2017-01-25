var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */
    var tcNavToday;
    var tcNavRange;
    var tcNavTotal;

    var dbStatus;
    var dbSave;

    /* local variables */
    var currentTemplate = ""; // store template associated with each day? or just have a template if set

    var localSelectedTimestamps = new Set();
    var localUnselectedTimestamps = new Set();
    var selectedTimestamps = new Set();
    var focusDate;
    var weekStart;
    var lastModified;

    var changesMade = false;
    var locked = false;
    var dayHours = [];
    var totalHours = 0.0;

    var slotDown = false;
    var slotToggleTo = true;

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

    return tc;
})();
// Justin Carlson