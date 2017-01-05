import datetime
import time
from flask import Flask, request, session, redirect, url_for, render_template, jsonify, abort
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config.from_pyfile('timecard.cfg')
db = SQLAlchemy(app)

slot_increment = app.config['SLOTINCREMENT']
slot_first_start = datetime.datetime.strptime(app.config['SLOTFIRSTSTART'], '%H:%M')
slot_last_start = datetime.datetime.strptime(app.config['SLOTLASTSTART'], '%H:%M')


class User(db.Model):
    __tablename__ = 'user'
    # rcs id, used for login
    rcsid = db.Column(db.String(16), primary_key=True)
    # actual name, for convenience
    name = db.column(db.String(32))
    #last_modified = db.Column(db.BigInteger)
    last_modified = db.Column(db.String(19))
    slots = db.relationship('Timeslot', backref='user', cascade="all, delete-orphan", lazy='dynamic')


class Timeslot(db.Model):
    __tablename__ = 'timeslot'
    # Uses BigInteger due to 2038 problem
    timestamp = db.Column(db.BigInteger, primary_key=True)
    parent_rcsid = db.Column(db.String(16), db.ForeignKey('user.rcsid'))


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
    #parent_rcsid = db.Column(db.String(16), db.ForeignKey('user.rcsid'))


def hours_range(start_time, end_time, increment):
    curr = start_time
    increment_delta = datetime.timedelta(minutes=increment)
    while curr <= end_time:
        yield curr
        curr = curr + increment_delta


@app.route('/')
#@app.route('/index')
def show_timecard():
    #if session['logged_in']:
    # session should contain info like privilege, username, name
    #session['username'] = app.config['USERNAME']

    # will be supplied by cas
    session['CAS_USERNAME'] = 'carlsj4'

    # days of week 0-6
    days=range(7)

    # times representing start of each cell eg. 8:30
    times = [slot for slot in hours_range(slot_first_start, slot_last_start, slot_increment)]

    return render_template('layout.html', initial_date=str(datetime.datetime.now()), slot_increment=slot_increment, slot_first_start=times[0].strftime("%H%M"), days=days, times=times)
    #else:
    #return redirect(url_for('login'))


@app.route('/update', methods = ['GET', 'POST'])
def update():
    u = db.session.query(User).get('carlsj4')

    if request.method == 'GET':
        # modify to recieve a list of dates and return timestamps, locked status for those dates
        
        ts_dict = {}
        ts_dict['modified'] = u.last_modified
        ts_dict['selected'] = []
        for ts in u.slots:
            ts_dict['selected'].append(str(ts.timestamp))
         
        return jsonify(**ts_dict)

    elif request.method == 'POST':
        content = request.get_json()

        # can check if an item exists with session.query(q.exists())
        # Add timestamps in 'selected'
        if (len(content['selected']) > 0):
            # TODO: Ignore duplicate timestamps and those in locked timecards (prior to lock date) unless admin
            # maybe have a lock date and refuse changes to timestamps prior, maybe lock by day/week
            u.slots.extend([Timeslot(timestamp=t) for t in content['selected']])
            u.last_modified = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")#int(time.time())
        
        # Delete timestamps in 'unselected'
        if (len(content['unselected']) > 0):
            db.session.query(Timeslot).filter(Timeslot.timestamp.in_(content['unselected']), Timeslot.parent_rcsid == u.rcsid).delete(synchronize_session='fetch')
            u.last_modified = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")#int(time.time())
           
        db.session.commit()

        return 'POST result'
    

#@app.route('/login', methods=['GET', 'POST'])
#def login():
#    error = None
#    if request.method == 'POST':
#        if request.form['username'] != app.config['USERNAME']:
#            error = 'Invalid username'
#        elif request.form['password'] != app.config['PASSWORD']:
#            error = 'Invalid password'
#        else:
#            session['logged_in'] = True
#            session['username'] = app.config['USERNAME']
#            return redirect(url_for('show_timecard'))
#    return render_template('login.html', error=error)


#@app.route('/logout')
#def logout():
#   session.clear()
#    session.pop('logged_in', None)
#    return render_template('logout.html')

#@app.errorhandler(404)
#def page_not_found(e):
#    return render_template('404.html'), 404

def init_db():
    # for use with command line argument to reset database
    # remember to change db in config

    db.drop_all()
    db.create_all()

    # creating users should be done through admin panel
    test_user = User(rcsid='carlsj4', name='Justin Carlson', last_modified = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S") )
    print test_user.last_modified
    db.session.add(test_user)

    db.session.commit()


if __name__ == '__main__':
	# for release, disable debugger and add argument for init_db
    init_db()

    if not slot_first_start < slot_last_start:
        raise RuntimeError('cfg error: SLOTFIRSTSTART must be before SLOTLASTSTART')

    app.run(threaded=True) # use different WSGI server for deployment