var TcAdmin = (function () {
    var tc = {};

    /* cached queries */
    var tsDays = [];

    var $periodNavPrev = $("#periodNavPrev"),
        $periodNavToday = $("#periodNavToday"),
        $periodNavNext = $("#periodNavNext");

    var $userAddButton = $("#userAddButton"),
        $userAddForm = $("#userAddForm"),
        $userAddStatus = $("#userAddStatus"),
        $userAddFormFirstname = $("#userAddFormFirstname"),
        $userAddFormLastname = $("#userAddFormLastname"),
        $userAddFormId = $("#userAddFormId"),
        $userAddFormSubmit = $("#userAddFormSubmit");

    var $userViewAsButton = $("#userViewAsButton"),
        $userEditButton = $("#userEditButton"),
        $userDeleteButton = $("#userDeleteButton");

    var $alertBanner = $("#alertBanner");

    var $tableStatus = $("#tableStatus");
    var $tsHeadCheckbox = $("#tsHeadCheckbox");

    /* local variables */
    var focusDate;
    var periodStart,
        periodEnd;

    var userData = {};
    var selectedUsers = new Set();

    /* public variables */
    tc.initialDate;
    tc.validPeriodStart;
    tc.periodDuration;
    tc.lockDate;

    tc.init = function () {
        for (var i = 0; i < tc.periodDuration; i++) {
            tsDays.push($("#tsDay" + i)[0]);
        }

        currentPeriod();
    }

    function onUserDataChanged() {
        updateTable();
    }

    function onSelectedUsersChanged() {
        updateCheckboxes();
        updateEdit();
    }

    function onPeriodChanged() {
        dbUpdateUsers();
        updateDays();
        updatePeriod();
    }

    function updateTable() {
        var $oldTsBody = $("#tsBody");
        var $newTsBody = $("<tbody>", {
            id: "tsBody"
        });
        
        for (var elem in userData) {
            var userId = elem;
            var userFirst = userData[elem]["firstname"];
            var userLast = userData[elem]["lastname"];

            var $newRow = $("<tr>", {
                "id": "tsRow" + userId,
                "data-userid": userId
            });
            $newTsBody.append($newRow);

            var $checkboxCell = $("<td>");
            $newRow.append($checkboxCell);

            var $checkbox = $("<label>", {
                class: "custom-control custom-checkbox"
            });
            $checkboxCell.append($checkbox);

            $checkbox.append($("<input>", {
                "type": "checkbox",
                "class": "custom-control-input",
                "data-userid": userId
            }));

            $checkbox.append($("<span>", {
                "class": "custom-control-indicator"
            }));

            $newRow.append($("<td>", {
                html: userLast + ", " + userFirst
            }));

            $newRow.append($("<td>", {
                html: userId
            }));

            $newRow.append($("<td>", {
                html: moment(userData[elem]["lastmodified"]).from(tc.initialDate)
                    // TODO: Need to update this value periodically
            }));

            for (var i = 0; i < tc.periodDuration; i++) {
                $newRow.append($("<td>", {
                    html: userData[elem]["ts-day-" + i].toFixed(1)
                }));
            }

            $newRow.append($("<td>", {
                html: userData[elem]["total"].toFixed(1),
                style: "text-align: center"
            }));
        }

        $oldTsBody.replaceWith($newTsBody);
        onSelectedUsersChanged();
    }

    function updateDays() {
        for (var i = 0; i < tsDays.length; i++) {
            var day = tsDays[i];
            var dayDate = moment(periodStart).add(i, "day");
            day.textContent = dayDate.format("MMM D"); //format("dddd, MMM D");
            //day.dataset.date = dayDate.format("YYYY-MM-DD")
        }
    }

    function updateCheckboxes() {
        var userCount = Object.keys(userData).length;

        if (selectedUsers.size == userCount) {
            $tsHeadCheckbox.prop("indeterminate", false);
            if (userCount == 0) {
                $tsHeadCheckbox.prop("checked", false);
            } else {
                $tsHeadCheckbox.prop("checked", true);
            }
        } else if (selectedUsers.size == 0) {
            $tsHeadCheckbox.prop("indeterminate", false);
            $tsHeadCheckbox.prop("checked", false);
        } else {
            $tsHeadCheckbox.prop("indeterminate", true);
        }

        $("#tsBody [type='checkbox']").each(function (index) {
            if (selectedUsers.has($(this).data("userid").toString())) {
                $(this).prop("checked", true);
            } else {
                $(this).prop("checked", false);
            }
        });
    }

    function updateEdit() {
        if (selectedUsers.size == 0) {
            $tableStatus.html("Users: " + Object.keys(userData).length);
            $userViewAsButton.css("display", "none");
            $userEditButton.css("display", "none");
            $userDeleteButton.css("display", "none");
        } else if (selectedUsers.size == 1) {
            var user = selectedUsers.values().next().value;
            $tableStatus.html(userData[user]["firstname"] + " " + userData[user]["lastname"]);
            $userViewAsButton.href = "/user/" + user;
            $userViewAsButton.css("display", "");
            $userEditButton.css("display", "");
            $userEditButton.data("userid", user);
            $userDeleteButton.css("display", "");
        } else {
            $tableStatus.html(selectedUsers.size + " users");
            $userViewAsButton.css("display", "none");
            $userEditButton.css("display", "none");
            $userDeleteButton.css("display", "");
        }
    }

    function updatePeriod() {
        periodNavToday.disabled = focusDate.isSame(tc.initialDate, "day");

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                periodRange.textContent = startDate.format("MMM D") + "–" + endDate.format("D, YYYY");
            } else {
                periodRange.textContent = startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY");
            }
        } else {
            periodRange.textContent = startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY");
        }
    }

    function dbUpdateUsers() {
        var updateDict = {
            "days": {}
        };

        for (var i = 0; i < tsDays.length; i++) {
            var lower = moment(periodStart).add(i, "day").startOf("day").unix();
            var upper = moment(periodStart).add(i, "day").endOf("day").unix();


            updateDict["days"]["ts-day-" + i] = [lower, upper];
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/users/update", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbUpdateUsersOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(updateDict));
    }

    function dbUpdateUsersOnload(status, response) {
        if (status == 200) {
            userData = response;
            onUserDataChanged();
        } else {
            // TODO: Display error regarding status (spinner icon?)
        }
    }

    // TODO: Convert to dbAddUsers to take dict of ids to firstnames and lastnames
    function dbAddUser(firstname, lastname, id) {
        var addDict = {
            "firstname": firstname,
            "lastname": lastname,
            "id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/users/add", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbAddUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(addDict));
    }

    function dbAddUserOnload(status, response) {
        if (status == 200) {
            showAlert("success", "", "Successfully added user")
        } else {
            showAlert("danger", "Error", "Failed to add user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    function dbEditUser(id, newId, newFirst, newLast) {
        var editDict = {
            "id": id,
            "new_id": newId,
            "new_first": newFirst,
            "new_last": newLast
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/users/edit", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbEditUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(editDict));
    }

    function dbEditUserOnload(status, response) {
        if (status == 200) {
            tc.infoBannerShow("User successfully edited");
        } else {
            tc.infoBannerShow("Failed to edit user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    // TODO: Convert to DeleteUsers and take array of ids
    function dbDeleteUser(id) {
        selectedUsers.delete(id);

        var deleteDict = {
            "id": id
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/users/delete", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            dbDeleteUserOnload(xhr.status, xhr.response);
        }
        xhr.send(JSON.stringify(deleteDict));
    }

    function dbDeleteUserOnload(status, response) {
        if (status == 200) {
            showAlert("success", "", "Successfully deleted user")
        } else {
            showAlert("danger", "Error", "Failed to delete user (Error " + status + ")");
        }
        dbUpdateUsers();
    }

    $("#tsTable").on("change", "[type='checkbox']", function () {
        if ($(this).is($tsHeadCheckbox)) {
            if (this.checked) {
                for (var elem in userData) {
                    selectedUsers.add(elem);
                }
            } else {
                selectedUsers.clear();
            }
        } else {
            var userId = $(this).data("userid").toString();

            if (this.checked) {
                selectedUsers.add(userId);
            } else {
                selectedUsers.delete(userId);
            }
        }

        onSelectedUsersChanged();
    });

    $userAddForm.on("show.bs.collapse", function () {
        $userAddButton.html("<i class='fa fa-times'></i>");
    });

    $userAddForm.on("hide.bs.collapse", function () {
        $userAddButton.html("<i class='fa fa-plus'></i> Add User");

        $userAddStatus.html("");
        $userAddFormFirstname.val("");
        $userAddFormLastname.val("");
        $userAddFormId.val("");
    });

    $userAddFormSubmit.on("click", function (e) {
        if (userAddFormFirstname.value.length > 0 &&
            userAddFormLastname.value.length > 0 &&
            userAddFormId.value.length > 0) {
            dbAddUser($userAddFormFirstname.val(), $userAddFormLastname.val(), $userAddFormId.val());
            $userAddForm.collapse("hide");
        } else {
            $userAddStatus.textContent = "Please fill required fields.";
        }
    });

    $userViewAsButton.on("click", function (e) {
        window.location.href = "/user/" + selectedUsers.values().next().value;
    });

    $userEditButton.on("click", function (e) {
        userEditShow();
        // TODO: Implement user editing
    });

    $userDeleteButton.on("click", function (e) {
        userDeleteSelected();
    });

    /*function userEditShow(id) {
        var nameInput = document.getElementById("tsRow" + id + "NameInput");
        nameInput.style.display = "";
        nameInput.value = userData[id]["firstname"] + " " + userData[id]["lastname"];
        nameInput.focus();
        nameInput.select();

        var nameLabel = document.getElementById("tsRow" + id + "NameLabel");
        nameLabel.style.display = "none";
    }

    function userEditCancel (id) {
        var nameInput = document.getElementById("tsRow" + id + "NameInput");
        nameInput.style.display = "none";
        if (nameInput.value != (userData[id]["firstname"] + " " + userData[id]["lastname"])) {
            // TODO: Revise functionality. Maybe go back to combined first and last name split serverside?
            // Also validate length and other criteria, display message if not valid
            var name = nameInput.value.split(" ", 2);
            dbEditUser(id, id, name[0], name[1]);
        }

        var nameLabel = document.getElementById("tsRow" + id + "NameLabel");
        nameLabel.style.display = "";
    }*/

    // TODO: Modify to use dbDeleteUsers to batch delete
    function userDeleteSelected() {
        for (var elem of selectedUsers) {
            dbDeleteUser(elem);
        }
    }

    function showAlert(type, title, content) {
        // success, info, warning, danger
        if (type == "success") {
            $alertBanner.html(
                "<div class='alert alert-success alert-dismissible fade show' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><strong>" + title + "</strong> " + content + "</div>"
            );
        } else if (type == "warning") {
            $alertBanner.html(
                "<div class='alert alert-warning alert-dismissible fade show' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><strong>" + title + "</strong> " + content + "</div>"
            );
        } else if (type == "danger") {
            $alertBanner.html(
                "<div class='alert alert-danger alert-dismissible fade show' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><strong>" + title + "</strong> " + content + "</div>"
            );
        } else {
            $alertBanner.html(
                "<div class='alert alert-info alert-dismissible fade show' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><strong>" + title + "</strong> " + content + "</div>"
            );
        }
    }

    $periodNavPrev.on("click", function () {
        prevPeriod();
    });

    $periodNavToday.on("click", function () {
        currentPeriod();
    });

    $periodNavNext.on("click", function () {
        nextPeriod();
    });

    function prevPeriod() {
        focusDate.subtract(tc.periodDuration, "day");
        periodStart.subtract(tc.periodDuration, "day");
        periodEnd.subtract(tc.periodDuration, "day");

        onPeriodChanged();
    }

    function currentPeriod() {
        focusDate = moment(tc.initialDate);
        periodStart = moment(tc.validPeriodStart);
        // Calculate start of the period the initialDate is in
        periodStart.add(Math.floor((focusDate.unix() - periodStart.unix()) / 60 / 60 / 24 / tc.periodDuration) * tc.periodDuration, "day");
        periodEnd = moment(periodStart).add(tc.periodDuration - 1, "day").endOf("day");

        onPeriodChanged();
    }

    function nextPeriod() {
        focusDate.add(tc.periodDuration, "day");
        periodStart.add(tc.periodDuration, "day");
        periodEnd.add(tc.periodDuration, "day");
        onPeriodChanged();
    }

    return tc;
})();
// Justin Carlson