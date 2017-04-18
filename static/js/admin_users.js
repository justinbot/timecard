var TcAdmin = (function () {
    var tc = {};

    /* cached queries */
    var $tsDays;

    var $loadingSpinner = $("#loadingSpinner"),
        $loadingCheck = $("#loadingCheck"),
        $loadingError = $("#loadingError");

    var $periodRange = $("#periodRange");

    var $userViewAsButton = $("#userViewAsButton"),
        $userEditButton = $("#userEditButton"),
        $userDeleteButton = $("#userDeleteButton");

    var $alertBanner = $("#alertBanner");

    var $tableStatus = $("#tableStatus");
    var $tsHeadCheckbox = $("#tsHeadCheckbox");

    var $tsHeaderName = $("#tsHeaderName"),
        $tsHeaderId = $("#tsHeaderId"),
        $tsHeaderModified = $("#tsHeaderModified"),
        $tsHeaderTotal = $("#tsHeaderTotal");

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
        var tsDays = [];
        for (var i = 0; i < tc.periodDuration; i++) {
            tsDays.push($("#tsDay" + i));
        }
        $tsDays = $(tsDays);

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

        for (var i = 0; i < userData.length; i++) {
            var userId = userData[i]["id"];
            var userFirst = userData[i]["name_first"];
            var userLast = userData[i]["name_last"];
            var userCreated = moment.utc(userData[i]["created_date"]).local();
            var userLastModified = moment.utc(userData[i]["last_modified"]).local();
            var userTotalHours = userData[i]["total_hours"];

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
                html: $("<a>", {
                    html: userLast + ", " + userFirst,
                    "href": "/user/" + userId
                })
            }));

            $newRow.append($("<td>", {
                html: userId
            }));

            $newRow.append($("<td>", {
                html: userLastModified.fromNow() //tc.initialDate
                    // TODO: Need to update this value periodically
            }));

            for (var j = 0; j < tc.periodDuration; j++) {
                $newRow.append($("<td>", {
                    html: userData[i]["hours"][j].toFixed(1)
                }));
            }

            $newRow.append($("<td>", {
                html: userTotalHours.toFixed(1),
                style: "text-align: center"
            }));
        }

        $oldTsBody.replaceWith($newTsBody);
        onSelectedUsersChanged();
    }

    function updateDays() {
        for (var i = 0; i < $tsDays.length; i++) {
            var day = $tsDays[i];
            var dayDate = moment(periodStart).add(i, "day");
            day.text(dayDate.format("MMM D")); //format("dddd, MMM D");
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

        $("#tsBody [type='checkbox']").each(function (index, element) {
            if (selectedUsers.has($(element).data("userid").toString())) {
                $(element).prop("checked", true);
            } else {
                $(element).prop("checked", false);
            }
        });
    }

    function updateEdit() {
        if (selectedUsers.size == 0) {
            $tableStatus.text("Users: " + Object.keys(userData).length);
            $userViewAsButton.hide();
            $userEditButton.hide();
            $userDeleteButton.hide();
        } else if (selectedUsers.size == 1) {
            var user = selectedUsers.values().next().value;
            $tableStatus.text(userData[user]["firstname"] + " " + userData[user]["lastname"]);
            $userViewAsButton.href = "/user/" + user;
            $userViewAsButton.show();
            $userEditButton.show();
            $userEditButton.data("userid", user);
            $userDeleteButton.show();
        } else {
            $tableStatus.text(selectedUsers.size + " users");
            $userViewAsButton.hide();
            $userEditButton.hide();
            $userDeleteButton.show();
        }
    }

    function updatePeriod() {
        $("#buttonPeriodToday").prop("disabled", focusDate.isSame(tc.initialDate, "day"));

        var startDate = moment(periodStart);
        var endDate = moment(periodEnd);
        if (startDate.isSame(endDate, "year")) {
            if (startDate.isSame(endDate, "month")) {
                $periodRange.text(startDate.format("MMM D") + "–" + endDate.format("D, YYYY"));
            } else {
                $periodRange.text(startDate.format("MMM D") + "–" + endDate.format("MMM D, YYYY"));
            }
        } else {
            $periodRange.text(startDate.format("MMM D, YYYY") + "–" + endDate.format("MMM D, YYYY"));
        }
    }

    function dbUpdateUsers() {
        $loadingSpinner.show();
        $loadingCheck.hide();
        $loadingError.hide();

        var dayBoundsDict = {
            "start": [],
            "end": []
        };

        for (var i = 0; i < $tsDays.length; i++) {
            var lower = moment(periodStart).add(i, "day").startOf("day").unix();
            var upper = moment(periodStart).add(i, "day").endOf("day").unix();

            //updateDict["days"]["ts-day-" + i] = [lower, upper];
            dayBoundsDict["start"].push(lower);
            dayBoundsDict["end"].push(upper);
        }

        $.ajax({
                "method": "GET",
                "url": "/api/users",
                "data": $.param(dayBoundsDict, true),
                "dataType": "json"
            })
            .done(function (data) {
                $loadingSpinner.hide();
                $loadingCheck.show();

                userData = data["users"];

                onUserDataChanged();
            })
            .fail(function () {
                $loadingSpinner.hide();
                $loadingError.show();
            });
    }

    // TODO: Convert to dbAddUsers to take dict of ids to firstnames and lastnames
    function dbAddUser(firstname, lastname, id) {
        $.ajax({
                "method": "POST",
                "url": "/api/users",
                "data": JSON.stringify({
                    "id": id,
                    "name_first": firstname,
                    "name_last": lastname
                }),
                "contentType": "application/json; charset=utf-8",
                "dataType": "json"
            })
            .done(function (json) {
                showAlert("success", "", "Successfully added user")
            })
            .fail(function (xhr, status, errorThrown) {
                showAlert("danger", "Error", "Failed to add user (" + errorThrown + ")");
            });

        /*var xhr = new XMLHttpRequest();
        xhr.open("POST", "/admin/users/add", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        // TODO: also set xhr.timeout and xhr.ontimeout?
        xhr.responseType = "json";
        xhr.onload = function () {
            if (xhr.status == 200) {
                showAlert("success", "", "Successfully added user")
            } else {
                showAlert("danger", "Error", "Failed to add user (Error " + xhr.status + ")");
            }
            dbUpdateUsers();
        }
        xhr.send(JSON.stringify(addDict));*/
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
            if (xhr.status == 200) {
                showAlert("User successfully edited");
            } else {
                showAlert("Failed to edit user (Error " + xhr.status + ")");
            }
            dbUpdateUsers();
        }
        xhr.send(JSON.stringify(editDict));
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
            if (xhr.status == 200) {
                showAlert("info", "", "Successfully deleted user")
            } else {
                showAlert("danger", "Error", "Failed to delete user (Error " + xhr.status + ")");
            }
            dbUpdateUsers();
        }
        xhr.send(JSON.stringify(deleteDict));
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

    $tsHeaderName.click(function () {
        console.log("TODO: Sort by name");
    });
    $tsHeaderId.click(function () {
        console.log("TODO: Sort by Id");
    });

    $tsHeaderModified.click(function () {
        console.log("TODO: Sort by Modified");
    });

    $tsHeaderTotal.click(function () {
        console.log("TODO: Sort by Total");
    });

    $("#formAddUser").on("show.bs.collapse", function () {
        $("#buttonAddUser").html($("<i>", {
            class: "fa fa-times"
        }));
    });

    $("#formAddUser").on("hide.bs.collapse", function () {
        $("#buttonAddUser").html($("<i>", {
            class: "fa fa-user-plus mr-1"
        }));
        $("#buttonAddUser").append("Add User");

        $("#addUserStatus").text("");
        $("#inputAddUserFirst").val("");
        $("#inputAddUserLast").val("");
        $("#inputAddUserId").val("");
    });

    $("#buttonAddUserSubmit").on("click", function (e) {
        var userFirst = $("#inputAddUserFirst").val();
        var userLast = $("#inputAddUserLast").val();
        var userId = $("#inputAddUserId").val();

        if (userFirst.length > 0 && userLast.length > 0 && userId.length > 0) {
            dbAddUser(userFirst, userLast, userId);
            $("#formAddUser").collapse("hide");
        } else {
            $("#addUserStatus").text("Please fill required fields.");
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
        var newAlert;

        $alertBanner.empty();
        if (type == "success") {
            newAlert = $("<div>", {
                "class": "alert alert-success alert-dismissible fade show",
                "role": "alert",
                "html": $("<i>", {
                    "class": "fa fa-check-circle mr-2"
                })
            });
        } else if (type == "warning") {
            newAlert = $("<div>", {
                "class": "alert alert-warning alert-dismissible fade show",
                "role": "alert",
                "html": $("<i>", {
                    "class": "fa fa-exclamation-triangle mr-2"
                })
            });
        } else if (type == "danger") {
            newAlert = $("<div>", {
                "class": "alert alert-danger alert-dismissible fade show",
                "role": "alert",
                "html": $("<i>", {
                    "class": "fa fa-exclamation-triangle mr-2"
                })
            });
        } else {
            newAlert = $("<div>", {
                "class": "alert alert-info alert-dismissible fade show",
                "role": "alert",
                "html": $("<i>", {
                    "class": "fa fa-info-circle mr-2"
                })
            });
        }

        newAlert.append("<strong>" + title + "</strong> " + content);

        newAlert.append($("<button>", {
            "type": "button",
            "class": "close",
            "data-dismiss": "alert",
            "html": "&times;"
        }));

        $alertBanner.append(newAlert);
    }

    $("#buttonPeriodPrev").on("click", function () {
        prevPeriod();
    });

    $("#buttonPeriodToday").on("click", function () {
        currentPeriod();
    });

    $("#buttonPeriodNext").on("click", function () {
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
        periodStart = moment(tc.initialPeriodStart);
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