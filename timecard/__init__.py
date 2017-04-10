import datetime
import json
from flask import Flask
from flask_cas import CAS
from timecard.models import db, init_db

app = Flask(__name__)
app.config.from_pyfile('server.cfg')
cas = CAS(app)
db.init_app(app)

#init_db(app)

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
try:
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
except IOError:
    # We need to handle this
    print 'config.json not found'

from timecard.user.views import mod
from timecard.admin.views import mod

app.register_blueprint(user.views.mod)
app.register_blueprint(admin.views.mod, url_prefix='/admin')
