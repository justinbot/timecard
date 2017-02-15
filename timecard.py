import datetime
from flask import Flask, request, Response, session, redirect, url_for, render_template, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import exc
from flask_cas import CAS, login_required, logout
from functools import wraps

app = Flask(__name__)
app.config.from_pyfile('timecard.cfg')
db = SQLAlchemy(app)
cas = CAS(app)

admins = None
period_duration = None
valid_period_start = None
view_days = None
slot_increment = None
slot_first_start = None
slot_last_start = None


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


def hours_range(start_time, end_time, increment):
    curr = start_time
    increment_delta = datetime.timedelta(minutes=increment)
    while curr <= end_time:
        yield curr
        curr = curr + increment_delta


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session['CAS_USERNAME'] not in admins:
            return abort(403)
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
@login_required
def show_user():
    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        abort(403)

    # times representing start of each cell eg. 8:30
    #times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    # TODO: Cleaner way to pass data? Maybe store persistent values in session
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                           valid_period_start=valid_period_start,
                           period_duration=view_days,
                           lock_date=1485925200,
                           slot_increment=slot_increment,
                           slot_first_start=slot_first_start.strftime("%H%M"),
                           slot_last_start=slot_last_start.strftime("%H%M")
                           )


@app.route('/update', methods=['POST'])
@login_required
def user_update():
    # Takes request with range of two UNIX timestamps
    # Returns all timestamps in range, and user last modified date

    # TODO: Combine pages so every action doesn't require its own route?

    request_json = request.get_json(silent=True)
    #print request_json

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
    response_dict['lastmodified'] = user.last_modified.strftime("%Y-%m-%d %H:%M:%S")
    response_dict['selected'] = [str(ts.timestamp) for ts in Timeslot.query.filter(
        Timeslot.user_id == user.id,
        Timeslot.timestamp >= lower_bound,
        Timeslot.timestamp <= upper_bound)]

    # print 'lastmodified:', response_dict['lastmodified']
    # print 'selected:', response_dict['selected']

    #print response_dict
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
        #print 'selected:', selected

        #user.timeslots.extend([Timeslot(timestamp=t) for t in selected])
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
        #print 'unselected:', unselected

        Timeslot.query.filter(Timeslot.user_id == user.id,
                              Timeslot.timestamp.in_(unselected)).delete(synchronize_session='fetch')
        db.session.commit()

    return Response()


@app.route('/admin')
@login_required
@admin_required
def show_admin():
    # TODO: Require admin
    return render_template(
        'admin.html',
        initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        valid_period_start=valid_period_start,
        period_duration=period_duration,
        lock_date=1485925200,
        slot_increment=slot_increment
    )


@app.route('/admin/update', methods=['POST'])
@login_required
@admin_required
def admin_update():
    request_json = request.get_json(silent=True)

    if not request_json or 'days' not in request_json:
        abort(400)

    lower_bound = request_json['days']['ts-day-0'][0]
    upper_bound = request_json['days']['ts-day-' + str(period_duration - 1)][1]

    response_dict = {}
    users = User.query.order_by(User.name_last, User.name_first)

    for user in users:
        user_times = [ts.timestamp for ts in Timeslot.query.filter(Timeslot.user_id == user.id,
                                                                   Timeslot.timestamp >= lower_bound,
                                                                   Timeslot.timestamp <= upper_bound)]
        user_dict = {}
        user_dict['firstname'] = user.name_first
        user_dict['lastname'] = user.name_last
        user_dict['lastmodified'] = user.last_modified.strftime("%Y-%m-%d %H:%M:%S")
        user_dict['total'] = 0

        for d in request_json['days']:
            day_lower_bound = request_json['days'][d][0]
            day_upper_bound = request_json['days'][d][1]
            day_times = [ts for ts in user_times if day_lower_bound <= ts <= day_upper_bound]

            day_hours = (len(day_times) * slot_increment) / 60.0

            user_dict[d] = day_hours
            user_dict['total'] += day_hours

        #print user_dict
        response_dict[user.id.lower()] = user_dict

    # print response_dict
    return jsonify(response_dict)


@app.route('/admin/add', methods=['POST'])
@login_required
@admin_required
def admin_add_user():
    request_json = request.get_json(silent=True)

    if not request_json or 'firstname' not in request_json or 'lastname' not in request_json or 'id' not in request_json:
        abort(400)

    first = request_json['firstname']
    last = request_json['lastname']
    id = request_json['id'].upper()

    if not (len(first) > 0 and len(last) > 0 and len(id) > 0):
        abort(400)

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


@app.route('/admin/edit', methods=['POST'])
@login_required
@admin_required
def admin_edit_user():
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


@app.route('/admin/delete', methods=['POST'])
@login_required
@admin_required
def admin_delete_user():
    request_json = request.get_json(silent=True)

    if not request_json or 'id' not in request_json:
        abort(400)

    user = User.query.filter_by(id=request_json['id'].upper()).first()
    if not user:
        abort(400)

    User.query.filter_by(id=request_json['id'].upper()).delete()

    db.session.commit()

    return Response()


@app.route('/user/<id>')
@login_required
@admin_required
def show_viewas(id):
    id = id.upper()

    user = User.query.filter_by(id=id).first()
    if not user:
        abort(404)

    times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    return render_template('viewas.html',
                           initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                           slot_increment=slot_increment,
                           slot_first_start=times[0].strftime("%H%M"),
                           period_duration=view_days,
                           valid_period_start=valid_period_start,
                           times=times,
                           user_id=id,
                           user_name=user.name_first + " " + user.name_last)


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
    response_dict['lastmodified'] = user.last_modified.strftime("%Y-%m-%d %H:%M:%S")
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

    print 'Reinitializing database, all information dropped'

    db.drop_all()
    db.create_all()

    # TODO: Initial lock date should be 00:00 on date database is created?

    db.session.commit()


if __name__ == '__main__':
    # for release, disable debugger and add argument for init_db to allow database resets
    # also add support for database export?

    #init_db()

    # TODO: initialization logic and error checking
    admins = app.config['ADMINS'].upper().replace(' ', '').split(',')
    if not len(admins) > 0:
        raise RuntimeError('cfg error: No admins specified')

    period_duration = int(app.config['PERIOD_DURATION'])
    valid_period_start = app.config['VALID_PERIOD_START']
    view_days = int(app.config['VIEW_DAYS'])
    slot_increment = int(app.config['SLOT_INCREMENT'])
    slot_first_start = datetime.datetime.strptime(app.config['SLOT_FIRST_START'], '%H:%M')
    slot_last_start = datetime.datetime.strptime(app.config['SLOT_LAST_START'], '%H:%M')

    if None in (period_duration, valid_period_start, view_days, slot_increment, slot_first_start, slot_last_start):
        raise RuntimeError('cfg error: None value')

    if not slot_first_start < slot_last_start:
        raise RuntimeError('cfg error: SLOT_FIRST_START must be before SLOT_LAST_START')

    app.run(threaded=True) # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
