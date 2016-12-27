var weekdays = [];

var tcNavToday;
var tcNavRange;
var tcNavTotal;

var templatesSelect;
var templatesButton;
var templatesTextInput;
var templatesSave;
var templatesDelete;

var databaseSave;

var slotIncrement;
var slotFirstStart;
var initialDate = moment.utc();
var focusDate;
//utc offset for est is -05:00. Times worked and displayed are in this zone
var currentTemplate = ""; // store template associated with each day? or just have a template if set

var localSelectedTimestamps = new Set();
var localUnselectedTimestamps = new Set();
var selectedTimestamps = new Set();

var dayTimestamps = {}; // Dictionary mapping day index to slot timestamps

var slotDown = false;
var slotToggleTo = true;

// TODO: Fix potentially broken locally selected slots when week is shifted
// TODO: Template delete button next to cancel. Also collect edit buttons (textinput, save, cancel, delete) in div
//       and normal buttons (select dropdown and edit button) in another div

function onload() {
    // might be called before or after script tag, though above code should be called first

    // maybe move these to script tag
    templatesSelect = document.getElementById("templates-select");
    templatesNew = document.getElementById("templates-new");
    templatesTextInput = document.getElementById("templates-textinput");
    templatesSave = document.getElementById("templates-save");
    templatesDelete = document.getElementById("templates-delete");

    // Get templates
    hideEditTemplate();
}

// fetch selectedTimestamps from database (selected in week range)
function getFromDatabase() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/update", true);
    // TODO: Give dates in header for which to fetch timestamps
    //xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.responseType = "json";
    xhr.onload = function () {
        if (xhr.status == 200) {
            loadTimestamps(xhr.response);
        }
    };

    // TODO: on error or bad status, show error
    xhr.send();

    for (var i = 0; i < weekdays.length; i++) {
        updateDayHeader(i);
    }
}

function loadTimestamps(response) {
    //console.log(response);
    //var result = JSON.parse(response);

    selectedTimestamps = new Set();
    console.log("selectedTimestamps cleared");
    for (var i = 0; i < response['selected'].length; i++) {
        selectedTimestamps.add(response['selected'][i]);
        //console.log(t);
    }

    for (var i = 0; i < weekdays.length; i++) {
        updateDayContent(i);
    }
}

// write localSelectedTimestamps to database
function saveToDatabase() {
    databaseSave.disabled = true;
    databaseSave.textContent = "Saved";

    var timestamps = JSON.stringify({
        selected: Array.from(localSelectedTimestamps),
        unselected: Array.from(localUnselectedTimestamps)
    });
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/update", true);
    xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");
    xhr.send(timestamps);

    for (var elem of localSelectedTimestamps) {
        selectedTimestamps.add(elem);
    }

    for (var elem of localUnselectedTimestamps) {
        selectedTimestamps.delete(elem);
    }

    localSelectedTimestamps = new Set();
    localUnselectedTimestamps = new Set();

    // TODO: Use "Last modified 01/01/00" "Saving..." and "All changes saved" "Unable to save (error xxxx)" to indicate save status
}

// update header of this day
function updateDayHeader(weekday) {
    var day = weekdays[weekday];
    var headerDate = day.children[0];
    var headerWeekday = day.children[1];

    // date associated with day at time of first slot
    var dayDate = moment(focusDate).startOf("week").add(weekday, "day");
    dayDate.set({
        'hour': slotFirstStart.hour(),
        'minute': slotFirstStart.minute()
    })
    day.dataset.date = dayDate.unix();

    headerDate.textContent = dayDate.format("MM[/]DD[/]YY");
    headerWeekday.textContent = dayDate.format("dddd");
}

// update slots of this day
function updateDayContent(weekday) {
    var day = weekdays[weekday];

    var slots = day.getElementsByTagName("td");
    dayTimestamps[weekday] = [];
    for (var i = 0; i < slots.length; i++) {
        // update timestamp of every slot by using its delta (seconds from first slot)
        var ts = slots[i].dataset.timestamp = day.dataset.date + slots[i].dataset.timedelta;
        dayTimestamps[weekday].push(ts);
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            slots[i].className = "tc-slot-selected";
        } else {
            slots[i].className = "tc-slot";
        }
    }

    updateDayHours(weekday);
}

// update hours label in header of this day
function updateDayHours(weekday) {
    var day = weekdays[weekday];
    var headerHours = day.children[2];

    var dayTotalHours = 0.0;
    for (var i = 0; i < dayTimestamps[weekday].length; i++) {
        var ts = dayTimestamps[weekday][i];
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            dayTotalHours += (slotIncrement / 60);
        }
    }

    // TODO: Resolve issue where 15 minute increment gets rounded to 0.3 hours
    day.dataset.totalhours = dayTotalHours;
    headerHours.textContent = "Hours: " + dayTotalHours.toFixed(1);

    // only needs to update hours for this day
    updateNavTotal();

    if (localSelectedTimestamps.size == 0 && localUnselectedTimestamps.size == 0) {
        databaseSave.disabled = true;
        databaseSave.textContent = "Saved";
    } else {
        databaseSave.disabled = false;
        databaseSave.textContent = "Save";
    }
}

function updateNavTotal() {
    var totalHours = 0.0;
    for (var i = 0; i < weekdays.length; i++) {
        totalHours += parseFloat(weekdays[i].dataset.totalhours);
    }

    // TODO: Same precision issue as day hours
    tcNavTotal.textContent = "Total Hours: " + totalHours.toFixed(1);
}

function currentWeek() {
    focusDate = moment(initialDate);
    tcNavToday.disabled = true;
    tcNavRange.textContent = moment(focusDate).startOf("week").format("MMM D") + " – " + moment(focusDate).endOf("week").format("D, YYYY");
    getFromDatabase();
}

// move focused date back one week
function prevWeek() {
    focusDate.subtract(1, "week");
    tcNavToday.disabled = focusDate.isSame(initialDate, "day");
    tcNavRange.textContent = moment(focusDate).startOf("week").format("MMM D") + " – " + moment(focusDate).endOf("week").format("D, YYYY");
    getFromDatabase();
}

// move focused date forward one week
function nextWeek() {
    focusDate.add(1, "week");
    tcNavToday.disabled = focusDate.isSame(initialDate, "day");
    tcNavRange.textContent = moment(focusDate).startOf("week").format("MMM D") + " – " + moment(focusDate).endOf("week").format("D, YYYY");
    getFromDatabase();

}

// returns true if slot is selected, else false
function slotSelected(slot) {
    return (slot.className == "tc-slot-selected");
}

function slotSelect(slot) {
    // this check may not be necessary
    if (!slotSelected(slot)) {
        slot.className = "tc-slot-selected";
        console.log(slot.dataset.timestamp + " selected");

        if (!selectedTimestamps.has(slot.dataset.timestamp)) {
            localSelectedTimestamps.add(slot.dataset.timestamp);
        }

        if (localUnselectedTimestamps.has(slot.dataset.timestamp)) {
            localUnselectedTimestamps.delete(slot.dataset.timestamp);
        }

        updateDayHours(slot.dataset.weekday);
    } else {
        console.log("selecting already selected slot");
    }
}

function slotUnselect(slot) {
    if (slotSelected(slot)) {
        slot.className = "tc-slot";
        console.log(slot.dataset.timestamp + " unselected");

        if (localSelectedTimestamps.has(slot.dataset.timestamp)) {
            localSelectedTimestamps.delete(slot.dataset.timestamp);
        }

        // if this was originally selected from the database, add it to be unselected
        if (selectedTimestamps.has(slot.dataset.timestamp)) {
            localUnselectedTimestamps.add(slot.dataset.timestamp);
        }

        updateDayHours(slot.dataset.weekday);
    } else {
        console.log("unselecting already unselected slot");
    }
}

function slotMouseOver(slot) {
    if (!slotDown) {
        return;
    }
    if (slotToggleTo) {
        slotSelect(slot); // changing slots to selected
    } else {
        slotUnselect(slot); // changing slots to unselected
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

function showEditTemplate() {
    templatesSelect.style.display = "none";
    templatesNew.style.display = "none";
    templatesTextInput.style.display = "inline";
    templatesSave.style.display = "inline";
    templatesDelete.style.display = "inline";

    if (templatesSelect.selectedIndex == 0) {
        // Making new template
        templatesTextInput.value = "New Template";
    } else {
        // Renaming existing template
        templatesTextInput.value = templatesSelect.options[templatesSelect.selectedIndex].text;
    }

    templateNameInput(templatesTextInput);
    templatesTextInput.focus();
}

function hideEditTemplate() {
    templatesSelect.style.display = "inline";
    templatesNew.style.display = "inline";
    templatesTextInput.style.display = "none";
    templatesSave.style.display = "none";
    templatesDelete.style.display = "none";

    templatesTextInput.value = "";
}

// When enter is pressed in text box
function templateNameInput(e) {
    /* if (event.keyCode == 13) {
        saveNewTemplate();
    }*/
    // Disable save button unless template name is unique
    templatesSave.disabled = false;
    for (var i = 0; i < templatesSelect.length; i++) {
        if (e.value.trim() == templatesSelect.options[i].text) {
            // Save button disabled unless template (update) or name changed (new)
            templatesSave.disabled = true;
            break;
        }
    }
}

function saveNewTemplate() {
    // send request to save new template
    templatesSelect.options[templatesSelect.options.length] = new Option(templatesTextInput.value.trim(), "new-template-value");
    hideEditTemplate();
}

function templateSelectChanged(select) {
    if (select.selectedIndex == 0) {
        templatesNew.textContent = "New Template";
    } else {
        templatesNew.textContent = "Edit Template";
    }

    // Apply template to hours
    // set all cells to unselected, select those in the template
}