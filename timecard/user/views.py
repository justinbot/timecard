from datetime import datetime

from flask import current_app, Blueprint, render_template, redirect, url_for, session
from flask_cas import login_required

from timecard.api import current_period_start
from timecard.models import config, admin_required, User

user_views = Blueprint('user', __name__, template_folder='../templates')


@user_views.route('/after_login')
@login_required
def after_login():
    # This endpoint is for redirecting the user after login via /login
    # Login via visiting another endpoint redirects to that same endpoint

    current_app.logger.info('Logged in', session['CAS_USERNAME'])
    # username is automatically stored in session CAS_USERNAME

    # TODO: redirect to admin panel if user is an admin

    if session['CAS_USERNAME'] in config['admins']:
        return redirect(url_for('admin.admin_users_page'))
    else:
        return redirect(url_for('.user_page'))


@user_views.route('/')
@login_required
def user_page():
    # Make sure this logged in user is in the system
    # TODO: Redirect to a useful page instead
    user = User.query.get_or_404(session['CAS_USERNAME'])

    return render_template('user.html',
                           user_id=user.id.lower(),
                           initial_date=datetime.now().isoformat(),  # now, in server's time zone
                           current_period_start=current_period_start().isoformat(),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'])


@user_views.route('/users/<user_id>/viewas', methods=['GET', 'DELETE'])
@login_required
@admin_required
def specified_user_view_as(user_id):
    user = User.query.get_or_404(user_id.upper())

    return render_template('viewas.html',
                           user_id=user.id.lower(),
                           user_name_first=user.name_first,
                           user_name_last=user.name_last,
                           initial_date=datetime.now().isoformat(),  # now, in server's time zone
                           current_period_start=current_period_start().isoformat(),
                           valid_period_start=config['valid_period_start'],
                           view_days=config['view_days'],
                           slot_increment=config['slot_increment'],
                           slot_first_start=config['slot_first_start'],
                           slot_last_start=config['slot_last_start'],
                           lock_date=config['lock_date'])
