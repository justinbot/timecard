# Timecard - Temporary Docs


### What is it?
Timecard is "A usable web-based payroll timecard system" designed to be:
- **Usable.** Intuitive and generally simple to use. Bonus: This helps reduce mistakes in hour entry.
- **Flexible.** Easily configurable for any organization’s needs.
- **Simple.** Simple to use, simple to set up, simple to maintain.
- **Powerful.** Makes use of the interesting data.


### Layout
The Timecard frontend can be divided into sections as follows:

The **User View** is a calendar-like view employees (or whomever is entering hours) see when they use Timecard.
- The number of days shown at once in the calendar is configurable as *Days to Display*.
- Selectable slots for each day start at *Start of Day* and end at *End of Day*
- The duration of each slot is configurable as *Slot Increment*.
- To fill or delete a segment of time, the user simply clicks a slot and drags out a segment. The change is immediately applied.
- *Templates* are a saved series of selections within a period which can be applied to any period.

The **Admin Panel** is the used by HR/Managers and consists of multiple sections.
- The **Users** section is used to add/remove/modify users and view hour data.
- The **Settings** section is used to add/remove administrators and configure Timecard settings.


### API
The Timecard backend is structured as follows:

**All Users**: /users
- `POST` Create new user, with endpoint /users/<id>.
    - `{ id : string, name_first : string, name_last : string }`
    - Return 201 with location if successful, 409 if user already exists (TODO).
- `GET` Fetch all-user data summary for period specified by URL query series of `start` and `end` pairs.

**Specified User**: /users/<user_id>
- `GET` Fetch *full* user data set, including all time-segments.
- `DELETE` Delete this user.

**Specified User Hours**: /users/<user_id>/hours
- `POST` Fill or delete a time segment for this user.
    - `{ start : int (timestamp), end : int (timestamp), delete : bool }`
- `GET` Fetch all time-segments in range specified by URL query `start` and `end`.

**Specified User Hours Segment**: /users/<user_id>/hours/<segment_id>
- `GET` Fetch time segment specified by segment_id.
- `DELETE` Delete time segment specified by segment_id.

**Specified User Templates**: /users/<user_id>/templates
- `POST` Create a new template with specified name and segments.
    - `{ name : string, segments: [[start, end], ...] }`
- `GET` Fetch all templates for this user.

**Specified User Specified Template**: /users/<user_id>/templates/<template_id>
- `GET` Fetch the template with this id.
- `DELETE` Delete the template with this id.
