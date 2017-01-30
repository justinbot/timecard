import datetime
from flask import Flask, request, Response, session, redirect, url_for, render_template, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from flask_cas import CAS, login_required, logout
from functools import wraps

app = Flask(__name__)
app.config.from_pyfile('timecard.cfg')
db = SQLAlchemy(app)
cas = CAS(app)

admins = None
slot_increment = None
slot_first_start = None
slot_last_start = None
pay_period = None


class User(db.Model):
    # id, also used for login
    id = db.Column(db.String, primary_key=True)
    # actual name
    name = db.Column(db.String)
    created_on = db.Column(db.DateTime, default=datetime.datetime.now())
    last_modified = db.Column(db.DateTime, default=datetime.datetime.now())
    timeslots = db.relationship('Timeslot', backref='user', cascade='all, delete-orphan', lazy='dynamic')


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
    # TODO: Configurable days to display
    # days of week 0-6
    days = range(7)

    # times representing start of each cell eg. 8:30
    times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    # TODO: Cleaner way to pass data? Maybe store persistent values in session
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                           slot_increment=slot_increment,
                           slot_first_start=times[0].strftime("%H%M"),
                           pay_period=pay_period,
                           days=days,
                           times=times)


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
    response_dict['lastmodified'] = user.last_modified.strftime("%Y-%m-%d %H:%M:%S")
    response_dict['selected'] = [str(ts.timestamp) for ts in Timeslot.query.filter(
        Timeslot.user_id == user.id,
        Timeslot.timestamp >= lower_bound,
        Timeslot.timestamp <= upper_bound)]

    # print 'lastmodified:', response_dict['lastmodified']
    # print 'selected:', response_dict['selected']

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
            except IntegrityError as err:
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
        slot_increment=slot_increment,
        pay_period=pay_period)


@app.route('/admin/update', methods=['POST'])
@login_required
@admin_required
def admin_update():
    request_json = request.get_json(silent=True)

    if not request_json or 'days' not in request_json:
        abort(400)

    lower_bound = request_json['days']['ts-day-0'][0]
    upper_bound = request_json['days']['ts-day-' + str(pay_period - 1)][1]

    response_dict = {}
    users = User.query.order_by(User.name)

    for user in users:
        user_times = [ts.timestamp for ts in Timeslot.query.filter(Timeslot.user_id == user.id, Timeslot.timestamp >= lower_bound, Timeslot.timestamp <= upper_bound)]
        user_dict = {}
        user_dict['id'] = user.id.lower()
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
        response_dict[user.name] = user_dict

    # print response_dict
    return jsonify(response_dict)


@app.route('/user/<id>')
@login_required
@admin_required
def show_viewas(id):
    id = id.upper()

    days = range(7)
    times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    return render_template('viewas.html',
                           initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                           slot_increment=slot_increment,
                           slot_first_start=times[0].strftime("%H%M"),
                           pay_period=pay_period,
                           days=days,
                           times=times,
                           user_id=id)


@app.route('/user/update', methods=['POST'])
@login_required
@admin_required
def viewas_update():
    request_json = request.get_json(silent=True)

    if not request_json or 'id' not in request_json or 'range' not in request_json:
        abort(400)

    user = User.query.filter_by(id=request_json['id']).first()
    if not user:
        print 'id', request_json['id'], 'not found'
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


def init_db():
    # for use with command line argument to reset database
    # remember to change db in config

    print 'Reinitializing database, all information dropped'

    db.drop_all()
    db.create_all()

    # TODO: creating users should only be done through admin panel
    # TODO: Initial lock date should be 00:00 on date first admin account is created?
    test_user = User(id='CARLSJ4', name='Justin Carlson')
    test_user_2 = User(id='SHINA2', name='Albert Shin')
    test_user_3 = User(id='TEST04', name='Firstname Lastname')

    db.session.add(test_user)
    db.session.add(test_user_2)
    db.session.add(test_user_3)

    db.session.commit()


if __name__ == '__main__':
    # for release, disable debugger and add argument for init_db to allow database resets
    # also add support for database export?
    #init_db()

    # TODO: initialization logic and error checking
    # require at least one admin, ...
    admins = app.config['ADMINS'].upper().replace(' ', '').split(',')

    if not len(admins) > 0:
        raise RuntimeError('cfg error: No admins specified')

    slot_increment = int(app.config['SLOT_INCREMENT'])
    slot_first_start = datetime.datetime.strptime(app.config['SLOT_FIRST_START'], '%H:%M')
    slot_last_start = datetime.datetime.strptime(app.config['SLOT_LAST_START'], '%H:%M')
    pay_period = app.config['PAY_PERIOD']

    if not slot_first_start < slot_last_start:
        raise RuntimeError('cfg error: SLOT_FIRST_START must be before SLOT_LAST_START')

    app.run(threaded=True) # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
