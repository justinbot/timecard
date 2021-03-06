import json
from datetime import datetime
from functools import wraps

from flask import current_app, session, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import validates

db = SQLAlchemy()

MAX_SEGMENT_DURATION = 86400  # Maximum TimeSegment duration in seconds

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
        if custom_config['valid_period_start'] != datetime.strptime(custom_config['valid_period_start'],
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


def set_config(new_config):
    # TODO: Create better/ more robust set of methods for handling settings
    global config
    config = new_config
    with open('config.json', 'w') as cfg_file:
        json.dump(config, cfg_file)


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session['CAS_USERNAME'] not in config['admins']:
            return abort(403)
        return f(*args, **kwargs)

    return decorated_function


def is_admin():
    return session['CAS_USERNAME'] in config['admins']

# class Project(db.Model):
#    project_id = db.Column(db.Integer, primary_key=True)

#    name = db.Column(db.String)
#    created_date = db.Column(db.DateTime, default=datetime.utcnow)


class User(db.Model):
    id = db.Column(db.String, primary_key=True)

    name_first = db.Column(db.String)
    name_last = db.Column(db.String)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    # modified will automatically update when a value is changed
    modified = db.Column(db.DateTime, default=datetime.utcnow)  # , onupdate=datetime.utcnow)

    time_segments = db.relationship('TimeSegment', backref='user', lazy='dynamic')

    templates = db.relationship('Template')

    @validates('id')  # Make sure id is all uppercase
    def validate_id(self, key, id):
        return id.upper()

    def to_dict(self):
        return {
            'id': self.id.lower(),
            'name_first': self.name_first,
            'name_last': self.name_last,
            'created_date': self.created_date.isoformat(),
            'modified': self.modified.isoformat()
        }


class TimeSegment(db.Model):
    """
    A date-dependent block of time consisting of a start and end Unix timestamp.
    """

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String,
                        db.ForeignKey('user.id'))
    # project_id = db.Column(db.Integer, db.ForeignKey('project.id'))

    start_timestamp = db.Column(db.BigInteger)
    end_timestamp = db.Column(db.BigInteger)

    # @validates('start_timestamp', 'end_timestamp')
    # def validate_timestamps(self, key, value):
    #    if key == 'end_timestamp':
    #        assert value - self.start_timestamp < MAX_SEGMENT_DURATION
    #    return value

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'start_timestamp': self.start_timestamp,
            'end_timestamp': self.end_timestamp
        }


# class Schedule(db.Model):
#    """A series of date-independent blocks of time representing a schedule that repeats every period.
#    """


# class ScheduleSegment(db.Model):
#    """A date-independent block of time consisting of a start and end time of day in 24-hour format.
#    """
#    id = db.Column(db.Integer, primary_key=True)

# day of the period, starting at 0
#    day = db.Column(db.Integer)
# 24-hour start and end times in the format 'hh:mm'


#    start = db.Column(db.String())
#    end = db.Column(db.String())


class Template(db.Model):
    """
    A series of date-independent TemplateSegments.
    """

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'))

    # name of the template
    name = db.Column(db.String)

    template_segments = db.relationship('TemplateSegment')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'segments': [seg.to_dict() for seg in self.template_segments]
        }


class TemplateSegment(db.Model):
    """
    A date-independent block of time consisting of a start and end time of day in 24-hour format.
    """

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('template.id'))

    # Start and end times just like Unix timestamp except in seconds since period start
    start_time = db.Column(db.Integer)
    end_time = db.Column(db.Integer)

    def to_dict(self):
        return {
            'id': self.id,
            'template_id': self.template_id,
            'start_time': self.start_time,
            'end_time': self.end_time
        }


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
