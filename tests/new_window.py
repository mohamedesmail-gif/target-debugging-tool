"""Unit check of the new-merchant window (25th of last month up to the 25th of this month). Run: python3 tests/new_window.py"""
import datetime, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from build_tracker_data import new_window
D = datetime.date
pw0, nw0, nw1 = new_window(D(2026, 11, 21))
assert (pw0, nw0, nw1) == (D(2026, 9, 25), D(2026, 10, 25), D(2026, 11, 25)), (pw0, nw0, nw1)   # November: 25 Oct up to 25 Nov
assert new_window(D(2026, 1, 10)) == (D(2025, 11, 25), D(2025, 12, 25), D(2026, 1, 25))           # year change
assert new_window(D(2026, 2, 28)) == (D(2025, 12, 25), D(2026, 1, 25), D(2026, 2, 25))
is_new = lambda jd: nw0 <= jd < nw1
assert is_new(D(2026, 10, 25)) and is_new(D(2026, 11, 24)) and not is_new(D(2026, 10, 24)) and not is_new(D(2026, 11, 25))
print('new_window: all checks passed')
