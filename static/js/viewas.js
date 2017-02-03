var TcView = (function () {
	var tc = {};

	/* DOM elements */

	var tcNavToday;
	var tcNavRange;
	var tcNavTotal;

	var dbStatus;

	var tcDays = [];

	/* local variables */
	var selectedTimestamps = new Set();

	var focusDate;
	var periodStart;

	var dayHours = [];
	var totalHours = 0.0;

	var slotDown = false;
	var slotToggleTo = true;

	/* public variables */
	tc.initialDate;
	tc.lockDate;
	tc.slotIncrement;
	tc.slotFirstStart;
	tc.periodDuration;
	tc.validPeriodStart;

	tc.userID;


	tc.init = function () {
		dbStatus = document.getElementById("db-status");

		tcNavToday = document.getElementById("tc-nav-today");
		tcNavRange = document.getElementById("tc-nav-range");
		tcNavTotal = document.getElementById("tc-nav-total");

		for (var i = 0; i < tc.periodDuration; i++) {
			tcDays.push(document.getElementById("tc-day-" + i));
		}

		tc.currentPeriod();
	}

	// fetch data from database in range of this period
	function getFromDatabase() {
		dbStatus.textContent = "Loading…";

		// specify range of timestamps to select
		var get_dict = {
			"id": tc.userID,
			"range": [moment(periodStart).unix(), moment(periodStart).add(tc.periodDuration, "day").unix()]
		};

		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/user/update", true);
		xhr.setRequestHeader("Content-Type", "application/json");
		// TODO: also set xhr.timeout and xhr.ontimeout?
		xhr.responseType = "json";
		xhr.onload = function () {
			getOnload(xhr.status, xhr.response);
		}
		xhr.send(JSON.stringify(get_dict));
	}

	function getOnload(status, response) {
		if (status == 200) {
			dbStatus.textContent = "Last modified: " + moment(response["lastmodified"]).fromNow();

			selectedTimestamps = new Set();
			for (var i = 0; i < response["selected"].length; i++) {
				selectedTimestamps.add(response["selected"][i]);
			}

			totalHours = 0.0;
			for (var i = 0; i < tcDays.length; i++) {
				dayUpdateContent(i);
			}

			navUpdateTotal();
		} else {
			dbStatus.textContent = "Failed to load data (Error " + status + ")";
		}
	}

	function navUpdate() {
		tcNavToday.disabled = focusDate.isSame(tc.initialDate, "day");

		var startDate = moment.unix(tcDays[0].dataset.date)
		var endDate = moment.unix(tcDays[tcDays.length - 1].dataset.date)
		if (startDate.isSame(endDate, "month")) {
			tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("D, YYYY");
		} else {
			tcNavRange.textContent = startDate.format("MMM D") + " – " + endDate.format("MMM D, YYYY");
		}
	}

	function navUpdateTotal() {
		// TODO: Same precision issue as day hours
		tcNavTotal.textContent = "Total Hours: " + totalHours.toFixed(1);
	}

	// set focused date to current period
	tc.currentPeriod = function () {
		focusDate = moment(tc.initialDate);
		periodStart = moment(tc.validPeriodStart);
		// Calculate start of the period the initialDate is in
		periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");

		for (var i = 0; i < tcDays.length; i++) {
			dayUpdateHeader(i);
		}

		navUpdate();

		getFromDatabase();
	}

	// move focused date back one period
	tc.prevPeriod = function () {
		focusDate.subtract(tc.periodDuration, "day");
		periodStart.subtract(tc.periodDuration, "day");

		for (var i = 0; i < tcDays.length; i++) {
			dayUpdateHeader(i);
		}

		navUpdate();

		getFromDatabase();
	}

	// move focused date forward one period
	tc.nextPeriod = function () {
		focusDate.add(tc.periodDuration, "day");
		periodStart.add(tc.periodDuration, "day");

		for (var i = 0; i < tcDays.length; i++) {
			dayUpdateHeader(i);
		}

		navUpdate();

		getFromDatabase();
	}

	// update date info for this day
	function dayUpdateHeader(d) {
		var day = tcDays[d];

		// date associated with day at time of first slot
		var dayDate = moment(periodStart).add(d, "day");
		dayDate.set({
			"hour": tc.slotFirstStart.hour(),
			"minute": tc.slotFirstStart.minute()
		})
		day.dataset.date = dayDate.unix();

		// highlight header of current day
		if (dayDate.isSame(tc.initialDate, "day")) {
			day.style.background = "#f5f5f5";
		} else {
			day.style.background = "";
		}

		day.children[0].textContent = dayDate.format("dddd, MMM D");
	}

	// update slots of this day
	function dayUpdateContent(d) {
		var day = tcDays[d];
		var slots = day.getElementsByTagName("td");

		dayHours[d] = 0.0;
		for (var i = 0; i < slots.length; i++) {
			var ts = slots[i].dataset.timestamp = (parseInt(day.dataset.date) + parseInt(slots[i].dataset.timedelta)).toString();
			if (selectedTimestamps.has(ts)) {
				slots[i].className = "tc-slot-selected-locked";
				dayHours[d] += tc.slotIncrement;
			} else {
				slots[i].className = "tc-slot-locked";
			}
		}

		totalHours += dayHours[d];
		day.children[1].textContent = "Hours: " + dayHours[d].toFixed(1);
	}

	return tc;
})();
// Justin Carlson