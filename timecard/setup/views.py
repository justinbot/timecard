from timecard.user.views import disable_setup
from flask import Blueprint, render_template, redirect, url_for
from flask_cas import CAS, login_required

mod = Blueprint('setup', __name__, template_folder='templates')

@mod.route('/welcome')
@login_required
def setup_welcome():
    return render_template('setup/setup.html', step='welcome')

@mod.route('/timeslot')
@login_required
def setup_timeslot():
    return render_template('setup/setup.html', step='timeslot')

@mod.route('/payperiod')
@login_required
def setup_payperiod():
    return render_template('setup/setup.html', step='payperiod')

@mod.route('/admin')
@login_required
def setup_admin():
    return render_template('setup/setup.html', step='admin')

@mod.route('/finish')
@login_required
def setup_finish():
    disable_setup()
    return redirect(url_for('user.show_user'))
