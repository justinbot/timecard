var TcAdmin = (function () {
    var tc = {};

    /* DOM elements */
    var tcNavToday;
    var tcNavRange;
    var tcNavTotal;

    var tsTable;
    var tsHead;
    var tsDays = [];

    /* local variables */
    var focusDate;
    var periodStart;

    /* public variables */
    // all values provided by server
    tc.slotIncrement;
    tc.initialDate;
    tc.lockDate;
    tc.payPeriod;
    tc.payDay;

    tc.init = function () {
        tcNavToday = document.getElementById("tc-nav-today");
        tcNavRange = document.getElementById("tc-nav-range");
        tcNavTotal = document.getElementById("tc-nav-total");

        tsTable = document.getElementById("ts-table");
        tsHead = document.getElementById("ts-head");

        for (var i = 0; i < tc.payPeriod; i++) {
            tsDays.push(document.getElementById("ts-day-" + i));
        }

        tc.currentWeek();
    }

    function getFromDatabase() {
        var get_ranges = {
            "days": {}
        };

        for (var i = 0; i < tsDays.length; i++) {
            var lower = moment(tsDays[i].dataset.date).startOf("day").unix();
            var upper = moment(tsDays[i].dataset.date).endOf("day").unix();

            get_ranges["days"]["ts-day-" + i] = [lower, upper];
        }

        console.log(get_ranges);


        /* // Test response:
        var response = {
            "Carlson, Justin": {
                "id": "carlsj4",
                "lastmodified": "2017-01-27 00:00:00",
                "ts-day-0": "0.0",
                "ts-day-1": "0.0",
                "ts-day-2": "0.0",
                "ts-day-3": "0.0",
                "ts-day-4": "0.0",
                "ts-day-5": "0.0",
                "ts-day-6": "0.0",
                "ts-day-7": "0.0",
                "ts-day-8": "0.0",
                "ts-day-9": "0.0",
                "ts-day-10": "0.0",
                "ts-day-11": "0.0",
                "ts-day-12": "0.0",
                "ts-day-13": "0.0",
                "ts-day-14": "0.0",
                "ts-day-15": "0.0",
                "total": "5.0"
            },

            "Shin, Albert": {
                "id": "albshin",
                "lastmodified": "2017-01-27 00:00:00",
                "ts-day-0": "0.0",
                "ts-day-1": "0.0",
                "ts-day-2": "0.0",
                "ts-day-3": "0.0",
                "ts-day-4": "0.0",
                "ts-day-5": "0.0",
                "ts-day-6": "0.0",
                "ts-day-7": "0.0",
                "ts-day-8": "0.0",
                "ts-day-9": "0.0",
                "ts-day-10": "0.0",
                "ts-day-11": "0.0",
                "ts-day-12": "0.0",
                "ts-day-13": "0.0",
                "ts-day-14": "0.0",
                "ts-day-15": "0.0",
                "total": "5.0"
            }
        }

        getOnload(200, response);
        
        */

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            getOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(get_ranges));
    }

    function getOnload(status, response) {
        if (status == 200) {
            var oldTsBody = tsTable.children[1];
            var newTsBody = document.createElement("tbody");

            for (var elem in response) {
                var newRow = newTsBody.insertRow();

                var nameCell = newRow.insertCell(0);
                nameCell.textContent = elem;

                var idCell = newRow.insertCell(1);
                idCell.textContent = response[elem]["id"];

                var lastModifiedCell = newRow.insertCell(2);
                lastModifiedCell.textContent = moment(response[elem]["lastmodified"]).from(tc.initialDate);

                for (var i = 0; i < tc.payPeriod; i++) {
                    var dayCell = newRow.insertCell();
                    // TODO: Same rounding error as everywhere else
                    dayCell.textContent = response[elem]["ts-day-" + i].toFixed(1);;
                }

                var totalCell = newRow.insertCell();
                totalCell.textContent = response[elem]["total"].toFixed(1);
            }

            tsTable.replaceChild(newTsBody, oldTsBody);
        } else {
            // TODO: Display error regarding status
        }
    }

    function navUpdate() {
        tcNavToday.disabled = focusDate.isSame(tc.initialDate, "day");
        
        var startDate = moment(tsDays[0].dataset.date)
        var endDate = moment(tsDays[tsDays.length - 1].dataset.date)
        if (startDate.isSame(endDate, "month")) {
            tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("D, YYYY");
        } else {
            tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("MMM D, YYYY");
        }
    }

    tc.currentWeek = function () {
        focusDate = moment(tc.initialDate);
        // TODO: Figure out how to get first day of current arbitrary pay period
        periodStart = moment(focusDate).startOf("week").subtract(1, "week").add(tc.payDay, "day");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        navUpdate();

        getFromDatabase();
    }

    tc.prevWeek = function () {
        focusDate.subtract(tc.payPeriod, "day");
        periodStart = moment(focusDate); //.startOf("week");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        navUpdate();

        getFromDatabase();
    }

    tc.nextWeek = function () {
        focusDate.add(tc.payPeriod, "day");
        periodStart = moment(focusDate); //.startOf("week");

        for (var i = 0; i < tsDays.length; i++) {
            tsUpdateDay(i);
        }

        navUpdate();

        getFromDatabase();
    }

    function tsUpdateDay(d) {
        var day = tsDays[d];
        var dayDate = moment(periodStart).add(d, "day");
        day.textContent = dayDate.format("MMM D"); //format("dddd, MMM D");
        day.dataset.date = dayDate.format("YYYY-MM-DD")
    }

    return tc;
})();
// Justin Carlson