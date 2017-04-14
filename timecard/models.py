import datetime, json
from flask import current_app, session, abort
from flask_sqlalchemy import SQLAlchemy
from functools import wraps

db = SQLAlchemy()


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
        current_app.logger.warning('Configuration: No admins specified')
    custom_config['admins'] = [s.upper() for s in custom_config['admins']]

    if not 7 <= custom_config['period_duration'] <= 30:
        current_app.logger.warning(
            'Configuration: period_duration (%s) not within expected range' % custom_config['period_duration'])

    try:
        if custom_config['valid_period_start'] != datetime.datetime.strptime(custom_config['valid_period_start'],
                                                                             '%Y-%m-%d').strftime('%Y-%m-%d'):
            raise ValueError
    except ValueError:
        current_app.logger.error(
            'Configuration: valid_period_start (%s) not a valid date' % custom_config['valid_period_start'])

    if not 0 < custom_config['view_days'] <= 30:
        current_app.logger.warning(
            'Configuration: view_days (%s) not within expected range' % custom_config['view_days'])

    if not 5 <= custom_config['slot_increment'] <= 240:
        current_app.logger.warning(
            'Configuration: slot_increment (%s) not within expected range' % custom_config['slot_increment'])

    if not custom_config['slot_first_start'] < custom_config['slot_last_start']:
        current_app.logger.error(
            'Configuration: slot_first_start (%s) not before slot_last_start (%s)' % (
                custom_config['slot_first_start'], custom_config['slot_last_start']))

    config = custom_config


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session['CAS_USERNAME'] not in config['admins']:
            return abort(403)
        return f(*args, **kwargs)

    return decorated_function


#class Project(db.Model):
#    project_id = db.Column(db.Integer, primary_key=True)

#    name = db.Column(db.String)
#    created_date = db.Column(db.DateTime, default=datetime.datetime.now)


class User(db.Model):
    id = db.Column(db.String, primary_key=True)

    name_first = db.Column(db.String)
    name_last = db.Column(db.String)
    created_date = db.Column(db.DateTime, default=datetime.datetime.now)
    last_modified = db.Column(db.DateTime, default=datetime.datetime.now)

    time_segments = db.relationship('TimeSegment')
                                    #backref='user')

    templates = db.relationship('Template')
                                #backref='user')

    schedule = db.relationship('Schedule')
                               #backref='user')


class TimeSegment(db.Model):
    """A date-dependent block of time consisting of a start and end UNIX timestamp.
    """

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'))
    #project_id = db.Column(db.Integer, db.ForeignKey('project.id'))

    start_timestamp = db.Column(db.BigInteger)
    end_timestamp = db.Column(db.BigInteger)


#class Schedule(db.Model):
#    """A series of date-independent blocks of time representing a schedule that repeats every period.
#    """


#class ScheduleSegment(db.Model):
#    """A date-independent block of time consisting of a start and end time of day in 24-hour format.
#    """
#    id = db.Column(db.Integer, primary_key=True)

    # day of the period, starting at 0
#    day = db.Column(db.Integer)
    # 24-hour start and end times in the format 'hh:mm'
#    start = db.Column(db.String())
#    end = db.Column(db.String())


class Template(db.Model):
    """A series of date-independent blocks of time.
    """

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'))

    # name of the template
    name = db.Column(db.String)

    template_segments = db.relationship('TemplateSegment')


class TemplateSegment(db.Model):
    """A date-independent block of time consisting of a start and end time of day in 24-hour format.
    """

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.String, db.ForeignKey('template.id'))

    # day of the period, starting at 0
    day = db.Column(db.Integer)

    # 24-hour start and end times in the format 'hh:mm'
    start_time = db.Column(db.String(5))
    end_time = db.Column(db.String(5))


# @app.cli.command()
def init_db(app):
    # for use with command line argument to reset database
    # remember to change db in config

    with app.app_context():
        app.logger.info('Reinitializing database, all information dropped')

        db.drop_all()
        db.create_all()

        # TODO: Initial lock date should be 00:00 on date database is created?

        db.session.commit()
