var databaseSaveButton

var slotIncrement
var slotFirstStart
var currentDate = moment.utc(); // Date we are focused on, starts are current date
//utc offset for est is -05:00. Times worked and displayed are in this zone

var localSelectedTimestamps = new Set();
var localUnselectedTimestamps = new Set();
var selectedTimestamps = new Set();

var dayTimestamps = {}; // Dictionary mapping day index to slot timestamps

var slotDown = false;
var slotToggleTo = true;

function onload() {
    //hideEditTemplate();
}

// TODO: Restore use of Set, ignore Edge
// Array extension method because array.includes is not well supported
//Array.prototype.has = function Has(element) {
//    return this.indexOf(element) > -1;
//}

// removes the first occurence of the specified element from the specified array
//function arrayRemove(array, element) {
//    index = array.indexOf(element);
//    if (index > -1) {
//        array.splice(index, 1);
//    }
//}

// fetch selectedTimestamps from database (selected in week range)
function getFromDatabase() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/update", true);
    //xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.responseType = "json";
    xhr.onload = function () {
        if (xhr.status == 200) {
            loadTimestamps(xhr.response);
        }
    };

    // TODO: on error or bad status, show error
    xhr.send();

    // TODO: Update day headers here, since we already know date and weekday
}

function loadTimestamps(response) {
    //console.log(response);
    //var result = JSON.parse(response);

    selectedTimestamps = new Set();
    for (let t of response['selected']) {
        selectedTimestamps.add(t);
        //console.log(t);
    }

    // TODO: Separate updating header and content for responsiveness
    for (var i = 0; i < 7; i++) {
        updateDay(i);
    }
}

// write localSelectedTimestamps to database
function saveToDatabase() {
    databaseSaveButton.disabled = true;

    var timestamps = JSON.stringify({
        selected: Array.from(localSelectedTimestamps),
        unselected: Array.from(localUnselectedTimestamps)
    });
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/update", true);
    xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.send(timestamps);
    //console.log(timestamps);

    localSelectedTimestamps = new Set();
    localUnselectedTimestamps = new Set();
    //getFromDatabase();

    // TODO: Use "Last modified 01/01/00" "Saving..." and "All changes saved" "Unable to save (error xxxx)" to indicate save status
}

// updates header and slot timestamps of the specified day
function updateDay(weekday) {
    var day = document.getElementById("timecard-day-" + weekday);
    var headerDate = day.children[0];
    var headerWeekday = day.children[1];

    var dayDate = moment(currentDate).startOf("week").add(weekday, "day"); // date of this day
    dayDate.set({
            'hour': slotFirstStart.hour(),
            'minute': slotFirstStart.minute()
        }) // at hour and minute of first slot
    day.dataset.date = dayDate.unix();

    headerDate.textContent = dayDate.format("MM[/]DD[/]YY");
    headerWeekday.textContent = dayDate.format("dddd");

    dayTimestamps[weekday] = [];
    var slots = day.getElementsByTagName("td");
    for (let s of slots) {
        // update timestamp of every slot by using its delta (seconds from first slot)
        var ts = s.dataset.timestamp = day.dataset.date + s.dataset.timedelta;
        dayTimestamps[weekday].push(ts);
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            //if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            s.className = "timecard-cell-selected";
        } else {
            s.className = "timecard-cell";
        }
    }

    updateDayHours(weekday);
}

function updateDayHours(weekday) {
    var day = document.getElementById("timecard-day-" + weekday);
    var headerHours = day.children[2];

    var totalHours = 0.0;
    for (let ts of dayTimestamps[weekday]) {
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            //if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            totalHours += (slotIncrement / 60);
        }
    }

    headerHours.textContent = "Hours: " + totalHours.toFixed(1);

    if (localSelectedTimestamps.size == 0 && localUnselectedTimestamps.size == 0) {
        databaseSaveButton.disabled = true;
        databaseSaveButton.textContent = "Saved";
    } else {
        databaseSaveButton.disabled = false;
        databaseSaveButton.textContent = "Save";
    }
}

// move focused date back one week
function prevWeek() {
    currentDate.subtract(1, "week");
    getFromDatabase();
}

// move focused date forward one week
function nextWeek() {
    currentDate.add(1, "week");
    getFromDatabase();

}

// returns true if slot is selected, else false
function slotSelected(slot) {
    return (slot.className == "timecard-cell-selected");
}

function slotSelect(slot) {
    if (!slotSelected(slot)) {
        slot.className = "timecard-cell-selected";
        localSelectedTimestamps.add(slot.dataset.timestamp);
        localUnselectedTimestamps.delete(slot.dataset.timestamp);
        //arrayRemove(localUnselectedTimestamps, slot.dataset.timestamp);

        updateDayHours(slot.dataset.weekday);
    }
}

function slotUnselect(slot) {
    if (slotSelected(slot)) {
        slot.className = "timecard-cell";
        localSelectedTimestamps.delete(slot.dataset.timestamp);
        // arrayRemove(localSelectedTimestamps, slot.dataset.timestamp);
        // if this was originally selected from the database, add it to be unselected
        if (selectedTimestamps.has(slot.dataset.timestamp)) {
            localUnselectedTimestamps.add(slot.dataset.timestamp);
        }

        updateDayHours(slot.dataset.weekday);
    }
}

function slotMouseOver(slot) {
    if (!slotDown) {
        return;
    }
    if (slotToggleTo) {
        slotSelect(slot); // changing cells to selected
    } else {
        slotUnselect(slot); // changing cells to unselected
    }
    // Hours changed, no longer template-valid
}

function slotMouseDown(slot) {
    slotDown = true;
    slotToggleTo = !slotSelected(slot);
    slotMouseOver(slot);
}

function slotMouseUp(slot) {
    slotDown = false;
}