/*
 * Projectile motion using only the three basic kinematic equations.
 *
 * For constant acceleration a along one axis:
 *
 *   (1)  v  = v0 + a t
 *   (2)  Δx = v0 t + ½ a t²
 *   (3)  v² = v0² + 2 a Δx
 *
 * A projectile has two independent axes. Horizontally a = 0; vertically a = -g.
 * Coordinates: x is horizontal distance, y is height above the ground (m).
 * The projectile is launched from (0, h) and the flight ends when y returns to 0.
 */
const Physics = (() => {
  const G = 9.81; // Earth's gravitational acceleration, m/s^2

  const GRAVITY_PRESETS = {
    Earth: 9.81,
    Moon: 1.62,
    Mars: 3.71,
    Jupiter: 24.79,
  };

  // --- The three kinematic equations (one axis, constant acceleration) -----

  /** Equation (1): v = v0 + a t */
  const velocity = (v0, a, t) => v0 + a * t;

  /** Equation (2): Δx = v0 t + ½ a t² */
  const displacement = (v0, a, t) => v0 * t + 0.5 * a * t * t;

  /** Equation (3): v² = v0² + 2 a Δx */
  const finalSpeedSquared = (v0, a, dx) => v0 * v0 + 2 * a * dx;

  // --- Projectile results --------------------------------------------------

  /**
   * Compute the full trajectory from the launch conditions.
   * Every result comes from one of the three kinematic equations; see the
   * "Mathematical models" section of the site for the derivation.
   */
  function solve(speed, angleDeg, height = 0, g = G) {
    if (!(speed >= 0) || !(height >= 0) || !(g > 0)) {
      throw new RangeError("speed and height must be >= 0 and g must be > 0");
    }

    const theta = (angleDeg * Math.PI) / 180;
    const v0x = speed * Math.cos(theta);
    const v0y = speed * Math.sin(theta);
    const rise = Math.max(v0y, 0);

    // Time to peak — equation (1) vertically with v = 0:  0 = v0y - g t
    const timeToPeak = rise / g;

    // Maximum height — equation (3) vertically with v = 0:  0 = v0y² - 2 g Δy
    const maxHeight = height + (rise * rise) / (2 * g);

    // Flight time — equation (2) vertically with Δy = -h:
    //   -h = v0y t - ½ g t²   →   ½ g t² - v0y t - h = 0
    // Quadratic formula, keeping the positive root.
    const flightTime = (v0y + Math.sqrt(v0y * v0y + 2 * g * height)) / g;

    // Range — equation (2) horizontally with a = 0:  R = v0x t
    const range = displacement(v0x, 0, flightTime);

    // Impact velocity — equation (3) vertically with Δy = -h (falling, so negative)
    const impactVy = -Math.sqrt(finalSpeedSquared(v0y, -g, -height));
    const impactSpeed = Math.hypot(v0x, impactVy);

    return {
      speed, angleDeg, height, g,
      v0x, v0y, timeToPeak, maxHeight, flightTime, range, impactVy, impactSpeed,

      /** {x, y} at time t, from equation (2) on each axis. */
      position(t) {
        return { x: displacement(v0x, 0, t), y: height + displacement(v0y, -g, t) };
      },

      /** {vx, vy} at time t, from equation (1) on each axis. */
      velocity(t) {
        return { vx: velocity(v0x, 0, t), vy: velocity(v0y, -g, t) };
      },

      /** Evenly spaced {t, x, y} samples over the whole flight. */
      sample(nPoints = 200) {
        const points = [];
        for (let i = 0; i < nPoints; i++) {
          const t = (flightTime * i) / (nPoints - 1);
          const { x, y } = this.position(t);
          points.push({ t, x, y: Math.max(y, 0) });
        }
        return points;
      },
    };
  }

  return { G, GRAVITY_PRESETS, velocity, displacement, finalSpeedSquared, solve };
})();
