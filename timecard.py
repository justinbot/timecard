import datetime
from flask import Flask, request, Response, session, redirect, url_for, render_template, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from flask_cas import CAS, login_required, logout

app = Flask(__name__)
app.config.from_pyfile('timecard.cfg')
db = SQLAlchemy(app)
cas = CAS(app)


slot_increment = int(app.config['SLOTINCREMENT'])
slot_first_start = datetime.datetime.strptime(app.config['SLOTFIRSTSTART'], '%H:%M')
slot_last_start = datetime.datetime.strptime(app.config['SLOTLASTSTART'], '%H:%M')
pay_period = app.config['PAY_PERIOD']


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


@app.route('/')
@login_required
def show_tc_user():
    # days of week 0-6
    days = range(7)

    # times representing start of each cell eg. 8:30
    times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    # TODO: Cleaner way to pass data? Maybe store persistent values in session
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                           slot_increment=slot_increment,
                           slot_first_start=times[0].strftime("%H%M"),
                           days=days,
                           times=times)


@app.route('/update', methods=['POST'])
def update():
    # Takes request with range of two UNIX timestamps
    # Returns all timestamps in range, and user last modified date

    # TODO: Combine pages so every action doesn't require its own route?

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        abort(400)

    request_json = request.get_json(silent=True)

    if not request_json or 'range' not in request_json:
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
def save():
    # Takes request contents of selected and unselected timestamps
    # Applies to database, ignoring timestamps for locked dates

    # TODO: request_json could also include template info?
    # a template consists of name and slots
    # if a template is present in 'templates', it will be overwritten/created
    # potential usability feature: know which template each week is using, select it on load

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        abort(400)

    request_json = request.get_json(silent=True)

    if not request_json or ('selected' not in request_json and 'unselected' not in request_json):
        # abort with error code 400 bad request
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
def show_tc_admin():
    return render_template(
        'admin.html',
        initial_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        slot_increment=slot_increment)


@app.route('/admin/update', methods = ['POST'])
def admin_update():
    request_json = request.get_json(silent=True)

    if not request_json:
        # abort with error code 400 bad request
        abort(400)

    lower_bound = request_json['days']['ts-day-' + str(pay_period-1)]['range'][0]
    upper_bound = request_json['days']['ts-day-' + str(pay_period-1)]['range'][1]

    response_dict = {}
    users = User.query.order_by(User.name)
    for user in users:
        times = [ts.timestamp for ts in Timeslot.query.filter(Timeslot.user_id == user.id, Timeslot.timestamp >= lower_bound, Timeslot.timestamp <= upper_bound)]
        user_dict = {}
        user_dict['id'] = user.id
        user_dict['lastmodified'] = user.last_modified.strftime("%Y-%m-%d %H:%M:%S")
        user_dict['total'] = 0

        for cnt in xrange(pay_period):
            day_lower_bound = request_json['days']['ts-day-' + str(cnt)]['range'][0]
            day_upper_bound = request_json['days']['ts-day-' + str(cnt)]['range'][1]
            day_times = [t for t in times if t >= day_lower_bound and t <= day_upper_bound]
            print day_times
            hour_amount = (len(day_times) * slot_increment) / 60.0
            user_dict['ts-day-' + str(cnt)] = hour_amount
            user_dict['total'] = user_dict['total'] + hour_amount
        # print user_dict
        response_dict[user.name] = user_dict
    # print response_dict
    return jsonify(response_dict)


@app.route('/login/redirect')
@login_required
def tc_login():
    # This endpoint is for redirecting the user after login

    print 'Logged in', cas.username
    # username is automatically stored in session CAS_USERNAME

    # TODO: redirect to admin panel if user is an admin

    return redirect(url_for('show_tc_user'))


def init_db():
    # for use with command line argument to reset database
    # remember to change db in config

    print 'Reinitializing database, all information dropped'

    db.drop_all()
    db.create_all()

    # TODO: creating users should only be done through admin panel
    # TODO: Initial lock date should be 00:00 on date first admin account is created?
    test_user = User(id='CARLSJ4', name='Justin Carlson')
    test_user2 = User(id='SHINA2', name='Albert Shin')

    #test_user_2 = User(id='testoa4', name='Test User')
    #test_user_2.timeslots = [Timeslot(timestamp = 1483799400)]

    db.session.add(test_user)
    db.session.add(test_user2)
    #db.session.add(test_user_2)
    db.session.commit()


if __name__ == '__main__':
    # for release, disable debugger and add argument for init_db to allow database resets
    # also add support for database export?
    #init_db()

    # TODO: initialization logic and error checking
    # require at least one admin, ...
    if not slot_first_start < slot_last_start:
        raise RuntimeError('cfg error: SLOT_FIRST_START must be before SLOT_LAST_START')

    app.run(threaded=True) # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
