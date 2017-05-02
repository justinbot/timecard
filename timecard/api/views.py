import json
from datetime import datetime

from timecard.models import admin_required, db, config, set_config, User, TimeSegment, Template, TemplateSegment

from flask import Blueprint, session, request, abort, jsonify
from flask_cas import login_required

api_views = Blueprint('api', __name__, url_prefix='/api')


@api_views.route('/users', methods=['POST', 'GET'])
@login_required
@admin_required
def all_users():
    """
    POST:   Create new user, with endpoint /users/<id>.
            Return 201 with location if successful, 409 if user already exists.
    GET:    Fetch all-user data summary for specified period.
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

        # TODO: test Respond with location header for new user
        return jsonify(), 201, {'location': '/users/{0}'.format(new_user.id)}

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
                selection_start = int(start_timestamps[i])
                selection_end = int(end_timestamps[i])

                if not selection_start < selection_end:
                    abort(400)

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

        return 'success', 200, {'Content-Type': 'text/plain'}


@api_views.route('/users/<user_id>/hours', methods=['POST', 'GET'])
@login_required
def specified_user_hours(user_id):
    """
    POST:   Fill or delete a time segment for this user.
    GET:    Fetch all time-segments in range specified by URL query.
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

        request_dict = request.get_json(silent=True)

        # Check that the request parameters are valid
        if not request_dict or 'start' not in request_dict or 'end' not in request_dict:
            abort(400)

        delete = request_dict['delete']
        # Order shouldn't matter as long as one is before the other
        segment_start = min(int(request_dict['start']), int(request_dict['end']))
        segment_end = max(int(request_dict['start']), int(request_dict['end']))

        if not segment_start < segment_end:
            abort(400)

        # TODO: Find any segments that intersect this one, use to create one segment
        # Segments are added sequentially. They may be adjacent, but may not overlap.
        # If 'Add' a new segment intersects with an existing segment, the new takes precedence and the old is trimmed.
        # 'Delete' is a segment (not id) of time during which there should be no segment (trim).

        if delete:
            segments = user.time_segments.filter(TimeSegment.start_timestamp <= segment_end,
                                                 TimeSegment.end_timestamp >= segment_start)

            # Trim each segment so it no longer intersects the specified period
            for s in segments:
                if s.start_timestamp >= segment_start and s.end_timestamp <= segment_end:
                    # Segment is fully inside, delete it
                    user.time_segments.remove(s)

                elif segment_start > s.start_timestamp and segment_end < s.end_timestamp:
                    new_segment_1 = TimeSegment(start_timestamp=s.start_timestamp, end_timestamp=segment_start - 1)
                    new_segment_2 = TimeSegment(start_timestamp=segment_end + 1, end_timestamp=s.end_timestamp)
                    user.time_segments.remove(s)
                    user.time_segments.append(new_segment_1)
                    user.time_segments.append(new_segment_2)

                elif s.start_timestamp < segment_start:
                    # end of segment intersects, trim it
                    s.end_timestamp = segment_start - 1

                elif s.end_timestamp > segment_end:
                    # start of segment intersects, trim it
                    s.start_timestamp = segment_end + 1

            user.modified = datetime.utcnow()
            db.session.commit()

            return 'success', 200, {'Content-Type': 'text/plain'}

        else:
            # Offset by 1 to get adjacent segments as well
            segments = user.time_segments.filter(TimeSegment.start_timestamp - 1 <= segment_end,
                                                 TimeSegment.end_timestamp + 1 >= segment_start)

            # Merge with segments contained by or adjacent to this one
            # Delete any segment contained, shift upper and lower bound to those of adjacent

            for s in segments:
                if s.start_timestamp >= segment_start and s.end_timestamp <= segment_end:
                    # Segment is fully inside, delete it
                    user.time_segments.remove(s)

                elif s.start_timestamp < segment_start:
                    # end of segment intersects, shift this lower bound
                    segment_start = s.start_timestamp
                    user.time_segments.remove(s)

                elif s.end_timestamp > segment_end:
                    # start of segment intersects, shift this upper bound
                    segment_end = s.end_timestamp
                    user.time_segments.remove(s)

            new_segment = TimeSegment(start_timestamp=segment_start, end_timestamp=segment_end)
            user.time_segments.append(new_segment)

            user.modified = datetime.utcnow()
            db.session.commit()
            # Respond with location header for new segment
            return jsonify(), 201, {'location': '/users/{0}/hours/{1}'.format(user_id, new_segment.id)}

    elif request.method == 'GET':
        # Return this user's time segments in range specified by args

        selection_start_timestamp = request.args.get('start')
        selection_end_timestamp = request.args.get('end')

        # Select all TimeSegments that intersect this selection. TODO: <= or <?
        time_segments = user.time_segments.filter(TimeSegment.start_timestamp <= selection_end_timestamp,
                                                  TimeSegment.end_timestamp >= selection_start_timestamp)

        segments_dict = {
            'modified': user.modified.isoformat(),
            'time_segments': [t.to_dict() for t in time_segments]
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

        return jsonify(segment.to_dict())

    elif request.method == 'DELETE':
        # Delete segment <segment_id>
        user.time_segments.remove(segment)
        # db.session.delete(segment)
        db.session.commit()

        return 'success', 200, {'Content-Type': 'text/plain'}


@api_views.route('/users/<user_id>/templates', methods=['POST', 'GET', 'DELETE'])
@login_required
def specified_user_templates(user_id):
    """
    POST:   Create a new template with specified segments.
    GET:    Fetch all templates for this user.
    DELETE: Delete template with specified id.
    """

    user_id = user_id.upper()

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    if request.method == 'POST':
        request_dict = request.get_json(silent=True)

        if not request_dict or 'name' not in request_dict or 'segments' not in request_dict or not len(
                request_dict['segments']) > 0:
            abort(400)

        new_template = Template(name=request_dict['name'])

        for seg in request_dict['segments']:
            new_template.template_segments.append(TemplateSegment(start_time=int(seg[0]), end_time=int(seg[1])))

        user.templates.append(new_template)
        db.session.commit()

        return jsonify(), 201, {'location': '/users/{0}/templates/{1}'.format(user_id, new_template.id)}

    elif request.method == 'GET':
        return jsonify({'templates': {t.id: t.to_dict() for t in user.templates}})


@api_views.route('/users/<user_id>/templates/<template_id>', methods=['GET', 'DELETE'])
@login_required
def specified_user_specified_template(user_id, template_id):
    """
    GET:    Fetch the template with this id.
    DELETE: Delete the template with this id.
    """

    user_id = user_id.upper()

    # Make sure this user exists.
    user = User.query.get_or_404(user_id)

    if not user.id.upper() == session['CAS_USERNAME'].upper():
        abort(403)

    template = Template.query.get_or_404(template_id)

    if request.method == 'GET':
        return jsonify(template.to_dict())

    elif request.method == 'DELETE':
        user.templates.remove(template)
        # db.session.delete(template)
        db.session.commit()

        return 'success', 200, {'Content-Type': 'text/plain'}


@api_views.route('/settings', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_settings_load():
    if request.method == 'GET':
        response_dict = {}
        response_dict['admins'] = [a.lower() for a in config['admins']]  # (', '.join(config['admins'])).lower()
        response_dict['period_duration'] = config['period_duration']
        response_dict['valid_period_start'] = config['valid_period_start']
        response_dict['view_days'] = config['view_days']
        response_dict['slot_increment'] = config['slot_increment']
        response_dict['slot_first_start'] = config['slot_first_start']
        response_dict['slot_last_start'] = config['slot_last_start']

        return jsonify(response_dict)

    elif request.method == 'POST':
        request_dict = request.get_json(silent=True)

        if not request_dict:
            abort(400)

        new_config = config

        # TODO: Validate values
        if 'admins' in request_dict:
            new_config['admins'] = [a.upper() for a in request_dict['admins']]

        if 'period_duration' in request_dict:
            new_config['period_duration'] = int(request_dict['period_duration'])

        if 'valid_period_start' in request_dict:
            new_config['valid_period_start'] = request_dict['valid_period_start']

        if 'view_days' in request_dict:
            new_config['view_days'] = int(request_dict['view_days'])

        if 'slot_increment' in request_dict:
            new_config['slot_increment'] = int(request_dict['slot_increment'])

        if 'slot_first_start' in request_dict:
            new_config['slot_first_start'] = request_dict['slot_first_start']

        if 'slot_last_start' in request_dict:
            new_config['slot_last_start'] = request_dict['slot_last_start']

        set_config(new_config)

        return 'success', 200, {'Content-Type': 'text/plain'}
