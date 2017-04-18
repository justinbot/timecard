"""
.../users/
    *All require login as admin*
    
    POST - Create new user, with endpoint /users/<id>. Return 201 with location, 409 if already exists
    GET - Fetch all-user data summary for specified period. Use query with timestamps?

../users/<id>
    *All require login as this user or admin, return 404 if user not found.*
    
    GET - Fetch full user data, including all time-segments.
    ?PATCH - Modify user data.
    DELETE - Delete user.

.../users/<id>/hours
    *All require login as this user, return 404 if user not found.*
    
    POST - Update hours data. Time-segment duration must be at most 24 hours.
    GET - Fetch hours in specified range. Use query with timestamps? Query period must be at least 24 hours.

.../users/<id>/templates
    *All require login as this user, return 404 if user or template not found.*

    POST - Create new template
    GET - Fetch all templates
    ?PUT - Update existing template
    DELETE - Delete existing template

.../settings

    GET - Fetch full settings profile
    PATCH - Update settings profile with change

.../login/redirect
    *redirect to .../ if user, or .../admin (which should redirect to .../admin/users) if admin*

.../
    GET - Fetch user view web page. Loads data and makes changes at /users/<id>.

.../admin/users
    GET - Fetch admin users view web page. Loads period summary data from /users.

.../admin/settings
    GET - Fetch admin settings view web page.

"""

from datetime import datetime

from timecard.models import admin_required, db, User, TimeSegment, Template, TemplateSegment

from flask import Blueprint, session, request, abort, jsonify
from flask_cas import login_required

api_views = Blueprint('api', __name__,  url_prefix='/api')

MAX_SEGMENT_DURATION = 86400  # Maximum TimeSegment duration in seconds


@api_views.route('/users', methods=['POST', 'GET'])
@login_required
@admin_required
def all_users():
    """
    POST:   Create new user, with endpoint /users/<id>.
            Return 201 with location if successful, 409 if user already exists.
    GET:    Fetch all-user data summary for specified period. Use query with timestamps?
    Only admins are allowed to create users or view summary.
    """

    if request.method == 'POST':
        request_dict = request.get_json(silent=True)

        # Check that the request parameters are valid
        if not request_dict:
            abort(400)

        user_id = request_dict['id']
        user_name_first = request_dict['name_first']
        user_name_last = request_dict['name_last']

        if not user_id or not user_name_first or not user_name_last:
            abort(400)

        new_user = User(id=user_id, name_first=user_name_first, name_last=user_name_last)

        db.session.add(new_user)
        db.session.commit()

        # Respond with location header for new user
        return jsonify(), 201, {'location': '/users/' + new_user.id}

    elif request.method == 'GET':
        # Return all-user data summary for specified period
        # Request args is a series of start and end timestamp pairs
        # Returns total hours between each pair

        start_timestamps = request.args.getlist('start')
        end_timestamps = request.args.getlist('end')

        range_start = start_timestamps[0]
        range_end = end_timestamps[-1]

        summary_dict = {
            'users': []
        }

        users = User.query.order_by(User.name_last, User.name_first)

        for u in users:
            user_dict = u.to_dict()
            user_dict['hours'] = []  # Array of totals, one per specified period

            # Select all TimeSegments of this user that intersect the full selection period
            time_segments = u.time_segments.filter(TimeSegment.start_timestamp <= range_end,
                                                   TimeSegment.end_timestamp >= range_start)

            # This will iterate each pair of (start, end) timestamps
            for i in range(len(start_timestamps)):
                selection_start = start_timestamps[i]
                selection_end = end_timestamps[i]

                if not selection_start < selection_end:
                    abort(400)

                selection_total = 7.0

                # select from time_segments those that intersect this selection
                selection_segments = time_segments.filter(TimeSegment.start_timestamp <= selection_end,
                                                          TimeSegment.end_timestamp >= selection_start)

                selection_total = 0.0
                for s in selection_segments:
                    # Trim start and end to the part that intersects this selection
                    segment_start = max(s.start_timestamp, selection_start)
                    segment_end = min(s.end_timestamp, selection_end)

                    selection_total += (segment_end - segment_start) / 3600  # Duration seconds converted to hours

                user_dict['hours'].append(selection_total)
                user_dict['total_hours'] = sum(user_dict['hours'])

            summary_dict['users'].append(user_dict)

        return jsonify(summary_dict)


@api_views.route('/users/<user_id>', methods=['GET', 'DELETE'])
@login_required
@admin_required
def specified_user(user_id):
    """
    GET:    Fetch full user data set, including all time-segments.
    PATCH:  Modify user data?
    DELETE: Delete this user.
    Only admins are allowed to modify user accounts.
    """

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    if request.method == 'GET':
        # Return full user information along with every associated TimeSegment

        user_dict = user.to_dict()
        user_dict['segments'] = [t.to_dict for t in user.time_segments]

        return jsonify(user_dict)

    elif request.method == 'DELETE':
        # delete this user and associated data
        db.session.delete(user)
        db.session.commit()

        return 'Success', 200, {'Content-Type': 'text/plain'}


@api_views.route('/users/<user_id>/hours', methods=['POST', 'GET'])
@login_required
def specified_user_hours(user_id):
    """
    POST:   Create new time segment.
    GET:    Fetch all time-segments in range specified by query.
    Only this user can modify their hours.
    """

    user_id = user_id.upper()

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    # Users can only modify their own hours.
    # Username should already be upper but just in case.
    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    if request.method == 'POST':
        # Create new segment, return url with id
        # TODO: Take 'create' and 'delete' arrays of (start, end)

        request_dict = request.get_json(silent=True)

        # Check that the request parameters are valid
        if not request_dict:
            abort(400)

        start_timestamp = request_dict['start']
        end_timestamp = request_dict['end']

        if not start_timestamp or not end_timestamp or not (start_timestamp - end_timestamp) <= MAX_SEGMENT_DURATION:
            abort(400)

        # TODO: Find any segments that intersect this one, use to create one segment

        new_segment = TimeSegment(start_timestamp=request_dict['start'], end_timestamp=request_dict['end'])

        user.time_segments.add(new_segment)
        db.session.commit()

        # Respond with location header for new segment
        return jsonify(), 201, {'location': '/users/' + user_id + '/hours/' + new_segment.id}

    elif request.method == 'GET':
        # Return all time segments in range specified by args

        selection_start_timestamp = request.args.get('start')
        selection_end_timestamp = request.args.get('end')

        # Select all TimeSegments that intersect this selection. TODO: <= or <?
        time_segments = user.time_segments.filter(TimeSegment.start_timestamp <= selection_end_timestamp,
                                                  TimeSegment.end_timestamp >= selection_start_timestamp)

        segments_dict = {
            'segments': [t.to_dict() for t in time_segments]
        }

        return jsonify(segments_dict)


@api_views.route('/users/<user_id>/hours/<segment_id>', methods=['GET', 'DELETE'])
def specified_user_hours_segment(user_id, segment_id):
    """
    GET:    Fetch time segment specified by segment_id.
    DELETE: Delete time segment specified by segment_id.
    Only this user can modify their hours.
    """

    user_id = user_id.upper()

    print 'specified_user_hours_segment'

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    # Make sure this time segment exists.
    # TODO: Make sure time segments are stored per user?
    segment = TimeSegment.query.get_or_404(segment_id)

    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    if request.method == 'GET':
        # Get segment <segment_id>
        segment_dict = {
            'id': segment.id,
            'start': segment.start,
            'end': segment.end
        }

        return jsonify(segment_dict)

    elif request.method == 'DELETE':
        # Delete segment <segment_id>
        db.session.delete(segment)
        db.session.commit()

        return 'Success', 200, {'Content-Type': 'text/plain'}


@api_views.route('/users/<user_id>/templates', methods=['GET', 'DELETE'])
@login_required
def specified_user_templates(user_id):
    user_id = user_id.upper()

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    pass
