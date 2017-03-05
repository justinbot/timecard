import datetime
import json
from flask import Flask, request, Response, session, redirect, url_for, render_template, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import exc
from flask_cas import CAS, login_required, logout
from functools import wraps

app = Flask(__name__)
app.config.from_pyfile('server.cfg')
db = SQLAlchemy(app)
cas = CAS(app)

config = {
    'admins': None,
    'period_duration': None,
    'valid_period_start': None,
    'view_days': None,
    'slot_increment': None,
    'slot_first_start': None,
    'slot_last_start': None
}

# load default configuration
with open('config_default.json') as config_default_file:
    config = json.load(config_default_file)

# load valid values from custom configuration
with open('config.json') as config_file:
    custom_config = json.load(config_file)

    if not len(custom_config['admins']) > 0:
        app.logger.warning('Configuration: No admins specified')
    custom_config['admins'] = [s.upper() for s in custom_config['admins']]

    if not 7 <= custom_config['period_duration'] <= 30:
        app.logger.warning(
            'Configuration: period_duration (%s) not within expected range' % custom_config['period_duration'])

    try:
        if custom_config['valid_period_start'] != datetime.datetime.strptime(custom_config['valid_period_start'], '%Y-%m-%d').strftime('%Y-%m-%d'):
            raise ValueError
    except ValueError:
        app.logger.error(
            'Configuration: valid_period_start (%s) not a valid date' % custom_config['valid_period_start'])

    if not 0 < custom_config['view_days'] <= 30:
        app.logger.warning(
            'Configuration: view_days (%s) not within expected range' % custom_config['view_days'])

    if not 5 <= custom_config['slot_increment'] <= 240:
        app.logger.warning(
            'Configuration: slot_increment (%s) not within expected range' % custom_config['slot_increment'])

    if not custom_config['slot_first_start'] < custom_config['slot_last_start']:
        app.logger.error(
            'Configuration: slot_first_start (%s) not before slot_last_start (%s)' % custom_config['slot_first_start'], custom_config['slot_last_start'])

    config = custom_config


class User(db.Model):
    # id, also used for login
    id = db.Column(db.String, primary_key=True)

    # actual name
    name_first = db.Column(db.String)
    name_last = db.Column(db.String)

    created_on = db.Column(db.DateTime, default=datetime.datetime.now())
    last_modified = db.Column(db.DateTime, default=datetime.datetime.now())
    # TODO: make sure timeslots are deleted when user is deleted
    timeslots = db.relationship('Timeslot',
                                #single_parent=True,
                                cascade='all, delete',
                                backref='user')
                                #lazy='dynamic')


class Timeslot(db.Model):
    # Uses BigInteger due to 2038 problem
    # potentially use index=True? Timestamps should be indexed on user id for performance
    timestamp = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'))


#class Template(db.Model):
#    __tablename__ = 'template'

    # name of the template
#    name = db.column(db.String(32), primary_key=True)
    # associated day slots (not a full timeslot, just time of day)
#    slots = db.relationship('Timeslot', backref='user', cascade="all, delete-orphan", lazy='dynamic')


#class Dayslot(db.Model):
#    __tablename__ = 'timeslot'
    # time of day
    #time = db.Column(db.BigInteger, primary_key=True)
    #parent_id = db.Column(db.String(16), db.ForeignKey('user.id'))

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session['CAS_USERNAME'] not in config['admins']:
            return abort(403)
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
@login_required
def show_user():
    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        abort(403)

    # TODO: Cleaner way to pass data? Maybe store persistent values in session
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'])


@app.route('/update', methods=['POST'])
@login_required
def user_update():
    # Takes request with range of two UNIX timestamps
    # Returns all timestamps in range, and user last modified date

    # TODO: Combine pages so every action doesn't require its own route?

    request_json = request.get_json(silent=True)

    if not request_json or 'range' not in request_json:
        abort(400)

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        print 'ERROR: Failed to lookup user', session['CAS_USERNAME']
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

    # jsonfiy creates a complete Response
    return jsonify(response_dict)


@app.route('/save', methods=['POST'])
@login_required
def user_save():
    # Takes request contents of selected and unselected timestamps
    # Applies to database, ignoring timestamps for locked dates

    # TODO: request_json could also include template info?
    # a template consists of name and slots
    # if a template is present in 'templates', it will be overwritten/created
    # potential usability feature: know which template each week is using, select it on load

    request_json = request.get_json(silent=True)

    if not request_json or ('selected' not in request_json and 'unselected' not in request_json):
        # abort with error code 400 bad request
        abort(400)

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        print 'ERROR: Failed to lookup user', session['CAS_USERNAME']
        abort(400)

    # can check if an item exists with session.query(q.exists())

    # Add timestamps in 'selected'
    if 'selected' in request_json:
        selected = request_json['selected']

        for t in selected:
            # TODO: Find more efficient way to ignore duplicate timestamps in bulk add?
            # TODO: Ignore changes to timestamps before lock date (unless admin?)
            user.timeslots.append(Timeslot(timestamp=t))
            try:
                db.session.commit()
            except exc.IntegrityError as err:
                db.session.rollback()
                # Will probably be a duplicate entry
                print 'DEBUG: Timeslot insertion integrity error'

        user.last_modified = datetime.datetime.now()
        db.session.commit()

    # Delete timestamps in 'unselected'
    if 'unselected' in request_json:
        unselected = request_json['unselected']

        Timeslot.query.filter(Timeslot.user_id == user.id,
                              Timeslot.timestamp.in_(unselected)).delete(synchronize_session='fetch')
        db.session.commit()

    return Response()


@app.route('/admin')
@app.route('/admin/users')
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


@app.route('/admin/users/update', methods=['POST'])
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


@app.route('/admin/users/add', methods=['POST'])
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


@app.route('/admin/users/edit', methods=['POST'])
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


@app.route('/admin/users/delete', methods=['POST'])
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


@app.route('/admin/settings')
@login_required
@admin_required
def show_admin_settings():
    return render_template(
        'admin_settings.html'
    )


@app.route('/admin/settings/update', methods=['POST'])
@login_required
@admin_required
def admin_settings_update():
    response_dict = {}
    response_dict['admins'] = (', '.join(config['admins'])).lower()
    response_dict['period_duration'] = config['period_duration']
    response_dict['valid_period_start'] = config['valid_period_start']
    response_dict['view_days'] = config['view_days']
    response_dict['slot_increment'] = config['slot_increment']
    response_dict['slot_first_start'] = config['slot_first_start']
    response_dict['slot_last_start'] = config['slot_last_start']

    #print config

    return jsonify(response_dict)


@app.route('/admin/settings/save', methods=['POST'])
@login_required
@admin_required
def admin_settings_save():
    request_json = request.get_json(silent=True)

    if not request_json:
        # abort with error code 400 bad request
        abort(400)

    # TODO: Validate values

    config['admins'] = request_json['admins'].replace(',', '').split()
    config['period_duration'] = int(request_json['period_duration'])
    config['valid_period_start'] = request_json['valid_period_start']
    config['view_days'] = int(request_json['view_days'])
    config['slot_increment'] = int(request_json['slot_increment'])
    config['slot_first_start'] = request_json['slot_first_start']
    config['slot_last_start'] = request_json['slot_last_start']

    return Response()

@app.route('/user/<id>')
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


@app.route('/user/update', methods=['POST'])
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


@app.route('/login/redirect')
@login_required
def tc_login():
    # This endpoint is for redirecting the user after login

    print 'Logged in', cas.username
    # username is automatically stored in session CAS_USERNAME

    # TODO: redirect to admin panel if user is an admin

    return redirect(url_for('show_user'))


#@app.cli.command()
def init_db():
    # for use with command line argument to reset database
    # remember to change db in config

    app.logger.info('Reinitializing database, all information dropped')

    db.drop_all()
    db.create_all()

    # TODO: Initial lock date should be 00:00 on date database is created?

    db.session.commit()


if __name__ == '__main__':
    # for release, disable debugger and add argument for init_db to allow database resets
    # also add support for database export?

    #init_db()

    app.run(threaded=True) # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
