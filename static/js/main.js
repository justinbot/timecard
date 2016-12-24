var weekdays = [];

var timecardTotalHours;

var databaseSaveButton;
var templatesSelect;
var templatesButton;
var templatesTextInput;
var templatesSaveButton;
var templatesDeleteButton;

var slotIncrement;
var slotFirstStart;
var currentDate = moment.utc(); // Date we are focused on, starts are current date
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
    
    //databaseSaveButton = document.getElementById("database-save-button");
    //databaseSaveButton.disabled = true;

    templatesSelect = document.getElementById("templates-select");
    templatesButton = document.getElementById("templates-button");
    templatesTextInput = document.getElementById("templates-textinput");
    templatesSaveButton = document.getElementById("templates-save-button");
    templatesDeleteButton = document.getElementById("templates-delete-button");
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

    // TODO: Update day headers here, since we already know date and weekday
}

function loadTimestamps(response) {
    //console.log(response);
    //var result = JSON.parse(response);

    selectedTimestamps = new Set();
    for (var i = 0; i < response['selected'].length; i++) {
        selectedTimestamps.add(response['selected'][i]);
        //console.log(t);
    }

    // TODO: Separate updating header and content for responsiveness
    for (var i = 0; i < weekdays.length; i++) {
        updateDay(i);
    }
}

// write localSelectedTimestamps to database
function saveToDatabase() {
    databaseSaveButton.disabled = true;
    databaseSaveButton.textContent = "Saved";

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
    var day = weekdays[weekday]; //document.getElementById("timecard-day-" + weekday);
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
    for (var i = 0; i < slots.length; i++) {
        // update timestamp of every slot by using its delta (seconds from first slot)
        var ts = slots[i].dataset.timestamp = day.dataset.date + slots[i].dataset.timedelta;
        dayTimestamps[weekday].push(ts);
        // time is selected if it was selected locally, or was selected in the database and not unselected locally
        if ((selectedTimestamps.has(ts) && !localUnselectedTimestamps.has(ts)) || localSelectedTimestamps.has(ts)) {
            slots[i].className = "timecard-slot-selected";
        } else {
            slots[i].className = "timecard-slot";
        }
    }

    updateDayHours(weekday);
}

function updateDayHours(weekday) {
    // TODO: Cache day objects?
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
    updateTotalHours();

    if (localSelectedTimestamps.size == 0 && localUnselectedTimestamps.size == 0) {
        databaseSaveButton.disabled = true;
        databaseSaveButton.textContent = "Saved";
    } else {
        databaseSaveButton.disabled = false;
        databaseSaveButton.textContent = "Save";
    }
}

function updateTotalHours() {
    var totalHours = 0.0;
    for (var i = 0; i < weekdays.length; i++) {
        totalHours += parseFloat(weekdays[i].dataset.totalhours);
    }

    // TODO: Same precision issue as day hours
    timecardTotalHours.textContent = "Total Hours: " + totalHours.toFixed(1);
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
    return (slot.className == "timecard-slot-selected");
}

function slotSelect(slot) {
    if (!slotSelected(slot)) {
        slot.className = "timecard-slot-selected";

        if (!selectedTimestamps.has(slot.dataset.timestamp)) {
            localSelectedTimestamps.add(slot.dataset.timestamp);
        }

        localUnselectedTimestamps.delete(slot.dataset.timestamp);

        updateDayHours(slot.dataset.weekday);
    }
}

function slotUnselect(slot) {
    if (slotSelected(slot)) {
        slot.className = "timecard-slot";

        localSelectedTimestamps.delete(slot.dataset.timestamp);

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
    templatesButton.style.display = "none";
    templatesTextInput.style.display = "inline";
    templatesSaveButton.style.display = "inline";
    templatesDeleteButton.style.display = "inline";

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
    var select = document.getElementById("templates-select");
    var templatesButton = document.getElementById("templates-button");
    var templatesTextInput = document.getElementById("templates-textinput");
    var templatesSaveButton = document.getElementById("templates-save-button");
    var templatesDeleteButton = document.getElementById("templates-delete-button");

    select.style.display = "inline";
    templatesButton.style.display = "inline";
    templatesTextInput.style.display = "none";
    templatesSaveButton.style.display = "none";
    templatesDeleteButton.style.display = "none";

    templatesTextInput.value = "";
}

// When enter is pressed in text box
function templateNameInput(e) {
    /* if (event.keyCode == 13) {
        saveNewTemplate();
    }*/
    var select = document.getElementById("templates-select");
    var templatesSaveButton = document.getElementById("templates-save-button");
    // Disable save button unless template name is unique
    templatesSaveButton.disabled = false;
    for (var i = 0; i < select.length; i++) {
        if (e.value.trim() == select.options[i].text) {
            // Save button disabled unless template (update) or name changed (new)
            templatesSaveButton.disabled = true;
            break;
        }
    }
}

function saveNewTemplate() {
    var templatesTextInput = document.getElementById("templates-textinput");
    var select = document.getElementById("templates-select");
    templatesSelect.options[select.options.length] = new Option(templatesTextInput.value.trim(), "new-template-value");
    hideEditTemplate();
}

function templateSelectChanged(select) {
    if (select.selectedIndex == 0) {
        document.getElementById("templates-button").textContent = "New Template";
    } else {
        document.getElementById("templates-button").textContent = "Edit Template";
    }

    // Apply template to hours
    // set all cells to unselected, select those in the template
}