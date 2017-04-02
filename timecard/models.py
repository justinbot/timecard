import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    # id, also used for login
    id = db.Column(db.String, primary_key=True)

    # actual name
    name_first = db.Column(db.String)
    name_last = db.Column(db.String)

    created_on = db.Column(db.DateTime, default=datetime.datetime.now)
    last_modified = db.Column(db.DateTime, default=datetime.datetime.now)
    # TODO: make sure timeslots are deleted when user is deleted
    timeslots = db.relationship('Timeslot',
                                #single_parent=True,
                                cascade='all, delete',
                                backref='user')
                                #lazy='dynamic')

    templates = db.relationship('Template',
                                cascade='all, delete',
                                backref='user')


class Timeslot(db.Model):
    # Uses BigInteger due to 2038 problem
    # potentially use index=True? Timestamps should be indexed on user id for performance
    timestamp = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('user.id'))


class Template(db.Model):
    # unique id
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.String, db.ForeignKey('user.id'))

    # name of the template
    name = db.Column(db.String)

    # array of timeblock strings
    #timeblocks = db.Column(db.PickleType)
    timeblocks = db.Column(db.String) # TODO: Don't do this


#@app.cli.command()
def init_db(app):
    # for use with command line argument to reset database
    # remember to change db in config

    with app.app_context():
        app.logger.info('Reinitializing database, all information dropped')

        db.drop_all()
        db.create_all()

        # TODO: Initial lock date should be 00:00 on date database is created?

        db.session.commit()
