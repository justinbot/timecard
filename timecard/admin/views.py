from datetime import datetime

from flask import Blueprint, render_template
from flask_cas import login_required

from timecard.api import current_period_start
from timecard.models import config, admin_required

admin_views = Blueprint('admin', __name__, url_prefix='/admin', template_folder='templates')


@admin_views.route('/')
@admin_views.route('/users', methods=['GET'])
@login_required
@admin_required
def admin_users_page():
    return render_template(
        'admin_users.html',
        initial_date=datetime.now().isoformat(),  # now, in server's time zone
        initial_period_start=current_period_start().isoformat(),
        period_duration=config['period_duration'],
        lock_date=config['lock_date'],
    )


@admin_views.route('/settings')
@login_required
@admin_required
def admin_settings_page():
    return render_template(
        'admin_settings.html'
    )