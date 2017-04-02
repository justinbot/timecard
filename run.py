from timecard import app

app.run(threaded=True) # use different WSGI server for deployment
# use app.run(threaded=True, host=app.config['HOST'], port=int(app.config['PORT']), debug=app.config['DEBUG']) for release
# default host 0.0.0.0, port 5000
# should be run in a virtualenv
