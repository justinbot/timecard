import json
import datetime

from flask import Flask
from flask_cas import CAS


def create_app(config_path):
    app = Flask(__name__)
    app.config.from_pyfile(config_path)

    #from timecard.models import cas
    CAS(app)

    from timecard.models import db
    db.init_app(app)

    # init_db()

    from timecard.api.views import api
    from timecard.user.views import user
    from timecard.admin.views import admin
    app.register_blueprint(api)
    app.register_blueprint(user)
    app.register_blueprint(admin)

    return app


if __name__ == '__main__':
    app = create_app('server.cfg')
    app.run(threaded=True)  # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
