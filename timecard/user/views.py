import datetime

from flask import current_app, Blueprint, render_template, redirect, url_for, session
from flask_cas import login_required

from timecard.models import config

user = Blueprint('user', __name__, template_folder='../templates')


@user.route('/login/redirect')
@login_required
def tc_login():
    # This endpoint is for redirecting the user after login

    current_app.logger.info('Logged in', session['CAS_USERNAME'])
    # username is automatically stored in session CAS_USERNAME

    # TODO: redirect to admin panel if user is an admin

    return redirect(url_for('show_user'))


@user.route('/')
@login_required
def user_page():
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'])


"""
@mod.route('/')
@login_required
def show_user():
    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        abort(403)

    # TODO: Cleaner way to pass data? Maybe store persistent values in session
    return render_template('user.html',
                           initial_date=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'])


@mod.route('/', methods=['GET'])
@login_required
def user_load():
    # Takes request with range of two UNIX timestamps
    # Returns all timestamps in range, and user last modified date

    request_json = request.get_json(silent=True)

    if not request_json or 'range' not in request_json:
        abort(400)

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        app.logger.error('ERROR: Failed to lookup user', session['CAS_USERNAME'])
        abort(400)

    # we only want timestamps inside these bounds
    # TODO: Make sure malformed requests don't break
    lower_bound = request_json['range'][0]
    upper_bound = request_json['range'][1]

    response_dict = {}
    response_dict['lastmodified'] = user.last_modified.strftime('%Y-%m-%d %H:%M:%S')
    response_dict['selected'] = [str(ts.timestamp) for ts in Timeslot.query.filter(
        Timeslot.user_id == user.id,
        Timeslot.timestamp >= lower_bound,
        Timeslot.timestamp <= upper_bound)]

    # jsonfiy creates a complete Response
    return jsonify(response_dict)


@mod.route('/save', methods=['POST'])
@login_required
def user_save():
    # Takes request contents of selected and unselected timestamps
    # Applies to database, ignoring timestamps for locked dates

    request_json = request.get_json(silent=True)

    if not request_json or ('selected' not in request_json and 'unselected' not in request_json):
        # abort with error code 400 bad request
        abort(400)

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        app.logger.error('ERROR: Failed to lookup user', session['CAS_USERNAME'])
        abort(400)

    # can check if an item exists with session.query(q.exists())

    # Add timestamps in 'selected'
    if 'selected' in request_json:
        selected = request_json['selected']

        for t in selected:
            # TODO: Find more efficient way to ignore duplicate timestamps in bulk add?
            # TODO: Ignore changes to timestamps before lock date (unless admin?)
            user.timeslots.append(Timeslot(timestamp=t))
            try:
                db.session.commit()
            except exc.IntegrityError as err:
                db.session.rollback()
                # Will probably be a duplicate entry
                app.logger.error('DEBUG: Timeslot insertion integrity error')

        user.last_modified = datetime.datetime.now()
        db.session.commit()

    # Delete timestamps in 'unselected'
    if 'unselected' in request_json:
        unselected = request_json['unselected']

        Timeslot.query.filter(Timeslot.user_id == user.id,
                              Timeslot.timestamp.in_(unselected)).delete(synchronize_session='fetch')
        db.session.commit()

    return Response()


@mod.route('/load/templates', methods=['POST'])
@login_required
def user_templates_load():
    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        app.logger.error('ERROR: Failed to lookup user', session['CAS_USERNAME'])
        abort(400)

    response_dict = {}
    # each template is a series of timeblock strings eg. 0-08:30-120
    response_dict['templates'] = [{'name': tmpl.name, 'timeblocks': tmpl.timeblocks.split(',') } for tmpl in user.templates]

    return jsonify(response_dict)


@mod.route('/save/templates', methods=['POST'])
@login_required
def user_save_templates():
    request_json = request.get_json(silent=True)

    if not request_json or 'templates' not in request_json:
        # abort with error code 400 bad request
        abort(400)

    user = User.query.filter_by(id=session['CAS_USERNAME']).first()
    if not user:
        app.logger.error('ERROR: Failed to lookup user', session['CAS_USERNAME'])
        abort(400)

    user.templates = []
    for t in request_json['templates']:
        name = t['name']

        # convert array of timeblocks nto a comma separated string
        timeblocks_string = ",".join(t['timeblocks'])

        # add the template to the user
        user.templates.append(Template(name=name, timeblocks=timeblocks_string))

    db.session.commit()

    return Response()


@mod.route('/login/redirect')
@login_required
def tc_login():
    # This endpoint is for redirecting the user after login

    app.logger.info('Logged in', cas.username)
    # username is automatically stored in session CAS_USERNAME

    # TODO: redirect to admin panel if user is an admin

    return redirect(url_for('show_user'))
    """
