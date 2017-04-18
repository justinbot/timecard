from datetime import datetime, timedelta
from math import floor

from timecard.models import config


def current_period_start():
    """

    :return: Calculates and returns a DateTime representing the start of the current time period.
    """

    valid_period_start = datetime.strptime(config['valid_period_start'], '%Y-%m-%d')
    period_duration = config['period_duration']
    # Seconds between now (in the server timezone) and the valid_period_start date
    delta_seconds = (datetime.now() - valid_period_start).total_seconds()

    return valid_period_start + timedelta(days=floor(delta_seconds / 60 / 60 / 24 / period_duration) * period_duration)
