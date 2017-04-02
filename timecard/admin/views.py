import datetime
import json
from timecard import config
from timecard.models import db, User, Template, Timeslot
from flask import Blueprint, session, render_template, jsonify, url_for, request, Response
from flask_cas import login_required
from functools import wraps

mod = Blueprint('admin', __name__, template_folder='templates')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session['CAS_USERNAME'] not in config['admins']:
            return abort(403)
        return f(*args, **kwargs)
    return decorated_function


@mod.route('/')
@mod.route('/users')
@login_required
@admin_required
def show_admin_users():
    return render_template(
        'admin_users.html',
        initial_date=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        valid_period_start=config['valid_period_start'],
        period_duration=config['period_duration'],
        lock_date=config['lock_date'],
    )


@mod.route('/users/update', methods=['POST'])
@login_required
@admin_required
def admin_users_update():
    request_json = request.get_json(silent=True)

    if not request_json or 'days' not in request_json:
        abort(400)

    lower_bound = request_json['days']['ts-day-0'][0]
    upper_bound = request_json['days']['ts-day-' + str(config['period_duration'] - 1)][1]

    response_dict = {}
    users = User.query.order_by(User.name_last, User.name_first)

    for user in users:
        user_times = [ts.timestamp for ts in Timeslot.query.filter(Timeslot.user_id == user.id,
                                                                   Timeslot.timestamp >= lower_bound,
                                                                   Timeslot.timestamp <= upper_bound)]
        user_dict = {}
        user_dict['firstname'] = user.name_first
        user_dict['lastname'] = user.name_last
        user_dict['lastmodified'] = user.last_modified.strftime('%Y-%m-%d %H:%M:%S')
        user_dict['total'] = 0

        for d in request_json['days']:
            day_lower_bound = request_json['days'][d][0]
            day_upper_bound = request_json['days'][d][1]
            day_times = [ts for ts in user_times if day_lower_bound <= ts <= day_upper_bound]

            day_hours = (len(day_times) * config['slot_increment']) / 60.0

            user_dict[d] = day_hours
            user_dict['total'] += day_hours

        response_dict[user.id.lower()] = user_dict

    return jsonify(response_dict)


@mod.route('/users/add', methods=['POST'])
@login_required
@admin_required
def admin_users_add_user():
    request_json = request.get_json(silent=True)

    if not request_json or 'firstname' not in request_json or 'lastname' not in request_json or 'id' not in request_json:
        abort(400)

    first = request_json['firstname']
    last = request_json['lastname']
    id = request_json['id'].upper()

    if not (len(first) > 0 and len(last) > 0 and len(id) > 0):
        abort(400)

    # TODO: Return user already exists?
    # For now, delete the user if it already exists
    User.query.filter_by(id=id).delete()

    # Split name on first space into First and Last
    #name = name.split(' ', 1)
    #first = name[0]
    #if len(name) > 1:
    #    last = name[1]
    #else:
    #    last = ''

    new_user = User(id=id, name_first=first, name_last=last)

    db.session.add(new_user)
    db.session.commit()

    return Response()


@mod.route('/users/edit', methods=['POST'])
@login_required
@admin_required
def admin_users_edit_user():
    request_json = request.get_json(silent=True)

    if not request_json or 'id' not in request_json:
        abort(400)

    user = User.query.filter_by(id=request_json['id'].upper()).first()
    if not user:
        abort(400)

    if 'new_id' in request_json:
        new_id = request_json['new_id']

        if not len(new_id) > 0:
            abort(400)

        new_id = request_json['new_id'].upper()
        user.id = new_id

    if 'new_first' in request_json:
        new_first = request_json['new_first']

        if not len(new_first) > 0:
            abort(400)

        user.name_first = new_first

        # Split name on first space into First and Last
        #new_name = new_name.split(' ', 1)
        #first = new_name[0]
        #if len(new_name) > 1:
        #    last = new_name[1]
        #else:
        #    last = ''

        #user.name_first = first
        #user.name_last = last

    if 'new_last' in request_json:
        new_last = request_json['new_last']

        if not len(new_last) > 0:
            abort(400)

        user.name_last = new_last

    db.session.commit()

    return Response()


@mod.route('/users/delete', methods=['POST'])
@login_required
@admin_required
def admin_users_delete_user():
    request_json = request.get_json(silent=True)

    if not request_json or 'id' not in request_json:
        abort(400)

    user = User.query.filter_by(id=request_json['id'].upper()).first()
    if not user:
        abort(400)

    User.query.filter_by(id=request_json['id'].upper()).delete()

    db.session.commit()

    return Response()


@mod.route('/user/<id>')
@login_required
@admin_required
def show_viewas(id):
    user = User.query.filter_by(id=id.upper()).first()
    if not user:
        abort(404)

    return render_template('viewas.html',
                           initial_date=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'],
                           user_id=user.id,
                           user_name=user.name_first + ' ' + user.name_last)


@mod.route('/user/update', methods=['POST'])
@login_required
@admin_required
def viewas_update():
    request_json = request.get_json(silent=True)

    if not request_json or 'id' not in request_json or 'range' not in request_json:
        abort(400)

    user = User.query.filter_by(id=request_json['id']).first()
    if not user:
        abort(400)

    # we only want timestamps inside these bounds
    # TODO: Make sure malformed requests don't break
    lower_bound = request_json['range'][0]
    upper_bound = request_json['range'][1]

    response_dict = {}
    response_dict['lastmodified'] = user.last_modified.strftime('%Y-%m-%d %H:%M:%S')
    response_dict['selected'] = [str(ts.timestamp) for ts in Timeslot.query.filter(
        Timeslot.user_id == user.id,
        Timeslot.timestamp >= lower_bound,
        Timeslot.timestamp <= upper_bound)]

    return jsonify(response_dict)


@mod.route('/settings')
@login_required
@admin_required
def show_admin_settings():
    return render_template(
        'admin_settings.html'
    )


@mod.route('/settings/update', methods=['POST'])
@login_required
@admin_required
def admin_settings_update():
    response_dict = {}
    response_dict['admins'] = [a.lower() for a in config['admins']]#(', '.join(config['admins'])).lower()
    response_dict['period_duration'] = config['period_duration']
    response_dict['valid_period_start'] = config['valid_period_start']
    response_dict['view_days'] = config['view_days']
    response_dict['slot_increment'] = config['slot_increment']
    response_dict['slot_first_start'] = config['slot_first_start']
    response_dict['slot_last_start'] = config['slot_last_start']

    return jsonify(response_dict)


@mod.route('/settings/save', methods=['POST'])
@login_required
@admin_required
def admin_settings_save():
    request_json = request.get_json(silent=True)

    if not request_json:
        # abort with error code 400 bad request
        abort(400)

    # TODO: Validate values
    if 'admins' in request_json:
        config['admins'] = [a.upper() for a in request_json['admins']]

    if 'period_duration' in request_json:
        config['period_duration'] = int(request_json['period_duration'])

    if 'valid_period_start' in request_json:
        config['valid_period_start'] = request_json['valid_period_start']

    if 'view_days' in request_json:
        config['view_days'] = int(request_json['view_days'])

    if 'slot_increment' in request_json:
        config['slot_increment'] = int(request_json['slot_increment'])

    if 'slot_first_start' in request_json:
        config['slot_first_start'] = request_json['slot_first_start']

    if 'slot_last_start' in request_json:
        config['slot_last_start'] = request_json['slot_last_start']

    # TODO: Write configuration to file

    return Response()


@mod.route('/settings/purgedb', methods=['POST'])
@login_required
@admin_required
def admin_purge_db():
    init_db()

    return Response()
