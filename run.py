from flask import Flask
from flask_cas import CAS


def create_app(config_path):
    app = Flask(__name__)
    app.config.from_pyfile(config_path)

    CAS(app)

    from timecard.models import db, init_db
    db.init_app(app)

    #with app.app_context():
        #db.drop_all()
        #db.create_all()
        #db.session.commit()
    #init_db(app)

    from timecard.api.views import api_views
    from timecard.user.views import user_views
    from timecard.admin.views import admin_views
    app.register_blueprint(api_views)
    app.register_blueprint(user_views)
    app.register_blueprint(admin_views)

    return app


if __name__ == '__main__':
    app = create_app('server.cfg')
    app.run(threaded=True)  # use different WSGI server for deployment
    # use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
    # default host 0.0.0.0, port 5000
    # should be run in a virtualenv
