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

from timecard.models import admin_required, db, User, TimeSegment, Template, TemplateSegment

from flask import Blueprint, session, request, abort, jsonify
from flask_cas import login_required

api = Blueprint('api', __name__,  url_prefix='/api')

MAX_SEGMENT_DURATION = 86400  # Maximum TimeSegment duration in seconds


@api.route('/users', methods=['POST', 'GET'])
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
        user_first = request_dict['first']
        user_last = request_dict['last']

        if not user_id or not user_first or not user_last:
            abort(400)

        new_user = User(id=user_id, name_first=user_first, name_last=user_last)

        db.session.add(new_user)
        db.session.commit()

        # Respond with location header for new user
        return jsonify(), 201, {'location': '/users/' + new_user.id}

    elif request.method == 'GET':
        # Return user data summary for specified period

        start_timestamp = request.args.get('start')
        end_timestamp = request.args.get('end')

        summary_dict = {

        }


@api.route('/users/<user_id>', methods=['GET', 'DELETE'])
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
        user_dict = {}
        return jsonify(user_dict)

    elif request.method == 'DELETE':
        # delete this user and associated data
        db.session.delete(user)
        db.session.commit()

        return 'Success', 200, {'Content-Type': 'text/plain'}


@api.route('/users/<user_id>/hours', methods=['POST', 'GET'])
@login_required
def specified_user_hours(user_id):
    """
    POST:   Create new time segment.
    GET:    Fetch all time-segments in range specified by query.
    Only this user can modify their hours.
    """

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    # Users can only modify their own hours.
    # Username should already be upper but just in case.
    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    if request.method == 'POST':
        # Create new segment, return url with id
        request_dict = request.get_json(silent=True)

        # Check that the request parameters are valid
        if not request_dict:
            abort(400)

        start_timestamp = request_dict['start']
        end_timestamp = request_dict['end']

        if not start_timestamp or not end_timestamp or not (start_timestamp - end_timestamp) <= MAX_SEGMENT_DURATION:
            abort(400)

        new_segment = TimeSegment(start_timestamp=request_dict['start'],
                                  end_timestamp=request_dict['end'])

        user.time_segments.add(new_segment)
        db.session.commit()

        # Respond with location header for new segment
        return jsonify(), 201, {'location': '/users/' + user_id + '/hours/' + new_segment.id}

    elif request.method == 'GET':
        # Return all time segments in range specified by query
        start_timestamp = request.args.get('start')
        end_timestamp = request.args.get('end')

        segments_dict = {
            'segments': []
        }

        return jsonify(segments_dict)


@api.route('/users/<user_id>/hours/<segment_id>', methods=['GET', 'DELETE'])
def specified_user_hours_segment(user_id, segment_id):
    """
    GET:    Fetch time segment specified by segment_id.
    DELETE: Delete time segment specified by segment_id.
    Only this user can modify their hours.
    """

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    # Make sure this time segment exists.
    # TODO: Make sure time segments are per user?
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


@api.route('/users/<user_id>/templates', methods=['GET', 'DELETE'])
@login_required
def specified_user_templates(user_id):
    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    pass
