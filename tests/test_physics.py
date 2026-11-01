"""Check the simulator against known textbook results."""

import math

import numpy as np
import pytest

from physics import G, displacement, final_speed_squared, solve, velocity


def test_kinematic_equations_agree():
    # Equation (3) follows from (1) and (2); check they are consistent
    v0, a, t = 7.0, -3.0, 2.5
    v = velocity(v0, a, t)
    dx = displacement(v0, a, t)
    assert v**2 == pytest.approx(final_speed_squared(v0, a, dx))


def test_range_at_45_degrees_from_ground():
    # Classic result: R = v^2 / g for a 45 degree launch from ground level
    assert solve(20, 45).range == pytest.approx(20**2 / G)


def test_range_formula_from_ground():
    # R = v0^2 sin(2 theta) / g when h = 0
    traj = solve(18, 27)
    assert traj.range == pytest.approx(18**2 * math.sin(math.radians(54)) / G)


def test_max_height_and_flight_time_straight_up():
    # Launched straight up: h_max = v^2 / (2g), t_flight = 2v / g
    traj = solve(15, 90)
    assert traj.max_height == pytest.approx(15**2 / (2 * G))
    assert traj.flight_time == pytest.approx(2 * 15 / G)
    assert traj.range == pytest.approx(0, abs=1e-9)


def test_flight_time_is_twice_time_to_peak_from_ground():
    traj = solve(30, 60)
    assert traj.flight_time == pytest.approx(2 * traj.time_to_peak)


def test_horizontal_launch_from_cliff():
    # Horizontal launch from height h: t = sqrt(2h/g), R = v t, no rise above h
    traj = solve(10, 0, height=20)
    t = math.sqrt(2 * 20 / G)
    assert traj.flight_time == pytest.approx(t)
    assert traj.range == pytest.approx(10 * t)
    assert traj.max_height == pytest.approx(20)


def test_complementary_angles_give_same_range():
    assert solve(25, 30).range == pytest.approx(solve(25, 60).range)


def test_best_angle_is_45_from_ground_and_lower_from_a_height():
    angles = np.arange(0, 90.01, 0.5)
    best_ground = max(angles, key=lambda a: solve(30, a).range)
    best_raised = max(angles, key=lambda a: solve(30, a, height=40).range)
    assert best_ground == pytest.approx(45)
    assert best_raised < 45


def test_impact_speed_matches_energy_conservation():
    # Without drag: v_impact^2 = v0^2 + 2gh
    traj = solve(12, 35, height=8)
    assert traj.impact_speed == pytest.approx(math.sqrt(12**2 + 2 * G * 8))


def test_trajectory_lands_at_range_and_peaks_at_max_height():
    traj = solve(22, 50, height=3, g=3.71)
    x_end, y_end = traj.position(traj.flight_time)
    _, y_peak = traj.position(traj.time_to_peak)
    _, vy_peak = traj.velocity(traj.time_to_peak)
    assert x_end == pytest.approx(traj.range)
    assert y_end == pytest.approx(0, abs=1e-9)
    assert y_peak == pytest.approx(traj.max_height)
    assert vy_peak == pytest.approx(0, abs=1e-9)
    _, _, y = traj.sample()
    assert y.max() <= traj.max_height + 1e-9


def test_lower_gravity_flies_farther():
    assert solve(20, 45, g=1.62).range > solve(20, 45, g=9.81).range


def test_invalid_inputs_raise():
    with pytest.raises(ValueError):
        solve(10, 45, g=0)
    with pytest.raises(ValueError):
        solve(-1, 45)
