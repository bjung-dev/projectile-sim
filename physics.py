"""Projectile motion using only the three basic kinematic equations.

For constant acceleration a along one axis:

    (1)  v  = v0 + a t
    (2)  Δx = v0 t + ½ a t²
    (3)  v² = v0² + 2 a Δx

A projectile has two independent axes. Horizontally a = 0; vertically a = -g.
Coordinates: x is horizontal distance, y is height above the ground (m).
The projectile is launched from (0, h) and the flight ends when y returns to 0.
"""

from dataclasses import dataclass
import math

import numpy as np

G = 9.81  # Earth's gravitational acceleration, m/s^2

GRAVITY_PRESETS = {
    "Earth": 9.81,
    "Moon": 1.62,
    "Mars": 3.71,
    "Jupiter": 24.79,
}


# --- The three kinematic equations (one axis, constant acceleration) -------

def velocity(v0, a, t):
    """Equation (1): v = v0 + a t"""
    return v0 + a * t


def displacement(v0, a, t):
    """Equation (2): Δx = v0 t + ½ a t²"""
    return v0 * t + 0.5 * a * t**2


def final_speed_squared(v0, a, dx):
    """Equation (3): v² = v0² + 2 a Δx"""
    return v0**2 + 2 * a * dx


# --- Projectile results ----------------------------------------------------

@dataclass
class Trajectory:
    v0x: float  # horizontal launch velocity, m/s
    v0y: float  # vertical launch velocity, m/s
    height: float  # launch height, m
    g: float  # gravitational acceleration, m/s^2
    time_to_peak: float  # s
    max_height: float  # m, above the ground
    flight_time: float  # s
    range: float  # horizontal distance at landing, m
    impact_vy: float  # vertical velocity at landing, m/s
    impact_speed: float  # m/s

    def position(self, t):
        """(x, y) at time t, from equation (2) on each axis."""
        x = displacement(self.v0x, 0.0, t)
        y = self.height + displacement(self.v0y, -self.g, t)
        return x, y

    def velocity(self, t):
        """(vx, vy) at time t, from equation (1) on each axis."""
        return velocity(self.v0x, 0.0, t), velocity(self.v0y, -self.g, t)

    def sample(self, n_points=200):
        """Evenly spaced (t, x, y) samples over the whole flight."""
        t = np.linspace(0, self.flight_time, n_points)
        x, y = self.position(t)
        return t, x, np.maximum(y, 0.0)


def solve(speed, angle_deg, height=0.0, g=G):
    """Compute the full trajectory from the launch conditions.

    Every result comes from one of the three kinematic equations; see the
    "Mathematical models" tab of the app for the step-by-step derivation.
    """
    if speed < 0 or height < 0 or g <= 0:
        raise ValueError("speed and height must be >= 0 and g must be > 0")

    theta = math.radians(angle_deg)
    v0x = speed * math.cos(theta)
    v0y = speed * math.sin(theta)

    # Time to peak — equation (1) vertically with v = 0:  0 = v0y - g t
    time_to_peak = max(v0y, 0.0) / g

    # Maximum height — equation (3) vertically with v = 0:  0 = v0y² - 2 g Δy
    max_height = height + max(v0y, 0.0) ** 2 / (2 * g)

    # Flight time — equation (2) vertically with Δy = -h:
    #   -h = v0y t - ½ g t²   →   ½ g t² - v0y t - h = 0
    # Quadratic formula, keeping the positive root.
    flight_time = (v0y + math.sqrt(v0y**2 + 2 * g * height)) / g

    # Range — equation (2) horizontally with a = 0:  R = v0x t
    range_ = displacement(v0x, 0.0, flight_time)

    # Impact velocity — equation (3) vertically with Δy = -h (falling, so negative)
    impact_vy = -math.sqrt(final_speed_squared(v0y, -g, -height))
    impact_speed = math.hypot(v0x, impact_vy)

    return Trajectory(
        v0x=v0x,
        v0y=v0y,
        height=height,
        g=g,
        time_to_peak=time_to_peak,
        max_height=max_height,
        flight_time=flight_time,
        range=range_,
        impact_vy=impact_vy,
        impact_speed=impact_speed,
    )
