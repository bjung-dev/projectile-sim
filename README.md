# Projectile Motion Simulator

An interactive website that animates projectile motion in real time and explains the math behind it. It's built with plain HTML, CSS and JavaScript (no frameworks, no build step), with equations typeset by [KaTeX](https://katex.org).

**▶ Live site: https://bjung-dev.github.io/projectile-sim/**

<!-- Add a screenshot here: ![Screenshot](screenshot.png) -->

## Features

- **Adjustable launch parameters:** launch speed, angle, and height, plus gravity (Earth, Moon, Mars, Jupiter, or a custom value)
- **Real-time animation:** the projectile flies at true simulated speed (with a 0.25× to 10× playback control), tracing its path with live velocity-component vectors and a readout of t, x, y, vx and vy
- **Instant updates:** moving any slider redraws the predicted path and recomputes the results
- **Results:** range, maximum height, total flight time, and impact speed
- **Comparison:** pin trajectories to overlay them and compare them in a table
- **Shareable links:** the current settings are saved in the URL
- **Mathematical models section:** step-by-step derivations, plus a worked example that uses your current settings
- Works on phones, and follows your system's light or dark mode

## The mathematical models

Everything is computed from the three basic kinematic equations for constant acceleration:

1. v = v₀ + a t
2. Δx = v₀ t + ½ a t²
3. v² = v₀² + 2 a Δx

Each axis is treated on its own: horizontally a = 0, and vertically a = −g. The launch velocity splits into v₀ₓ = v₀ cos θ and v₀y = v₀ sin θ.

| Quantity | Equation used | Result |
|---|---|---|
| Maximum height | (3), vertical, v = 0 at the peak | y_max = h + (v₀ sin θ)² / 2g |
| Time to peak | (1), vertical, v = 0 at the peak | t_peak = v₀ sin θ / g |
| Total flight time | (2), vertical, Δy = −h | t = [v₀ sin θ + √((v₀ sin θ)² + 2gh)] / g |
| Range | (2), horizontal, a = 0 | R = v₀ cos θ · t_flight |

From level ground (h = 0), these reduce to t = 2v₀ sin θ / g and R = v₀² sin 2θ / g. The range is greatest at θ = 45°.

**Assumptions:** no air resistance, constant gravity, flat ground, and a point-mass projectile.

## Validation

[`tests/index.html`](tests/index.html) runs [`tests/physics.test.js`](tests/physics.test.js) in the browser and checks the model against textbook results:

| Check | Expected result |
|---|---|
| 45° launch from the ground | R = v²/g |
| Any angle from the ground | R = v² sin 2θ / g |
| Straight-up launch | h_max = v²/2g, t = 2v/g |
| Launch from the ground | t_flight = 2 t_peak |
| Horizontal launch from a cliff | t = √(2h/g) |
| Complementary angles (30° and 60°) | Equal range |
| Optimal angle | 45° from the ground, below 45° from a height |
| Impact speed | Matches energy conservation, v² = v₀² + 2gh |
| Trajectory consistency | Lands at y = 0 at x = R; vy = 0 at the peak |

On the live site, these run at [/tests/](https://bjung-dev.github.io/projectile-sim/tests/).

## Running locally

No install is needed. Open `index.html` in a browser. (Equation rendering loads KaTeX from a CDN, so it needs an internet connection.)

## Project structure

```
index.html            Page: simulator + mathematical models
css/style.css         Styles (light and dark themes, mobile layout)
js/physics.js         The three kinematic equations and the projectile solver
js/app.js             Controls, canvas animation, tables and worked example
tests/index.html      Browser test runner
tests/physics.test.js Validation tests
```

## Built with Claude Code

This project was developed in VS Code with [Claude Code](https://claude.com/claude-code) as an AI pair programmer.
