# Projectile Motion Simulator

An interactive web app that animates projectile motion in real time and explains the math behind it. Built in Python with [Streamlit](https://streamlit.io) and [Plotly](https://plotly.com/python/).

<!-- Add a screenshot here: ![Screenshot](screenshot.png) -->

## Features

- **Adjustable launch parameters:** launch speed, angle, and height, plus gravity (Earth, Moon, Mars, Jupiter, or a custom value)
- **Real-time animation:** the projectile flies at true simulated speed (with a 0.25× to 10× playback control), tracing its path with live velocity-component vectors and a readout of t, x, y, vₓ and v_y
- **Instant updates:** moving any slider redraws the predicted path and recomputes the results
- **Results:** range, maximum height, total flight time, and impact speed
- **Comparison:** pin trajectories to overlay them and compare them in a table
- **Mathematical models tab:** step-by-step derivations, plus a worked example that uses your current settings

## The mathematical models

Everything is computed from the three basic kinematic equations for constant acceleration:

1. v = v₀ + a t
2. Δx = v₀ t + ½ a t²
3. v² = v₀² + 2 a Δx

Each axis is treated on its own: horizontally a = 0, and vertically a = −g. The launch velocity splits into v₀ₓ = v₀ cos θ and v₀ᵧ = v₀ sin θ.

| Quantity | Equation used | Result |
|---|---|---|
| Maximum height | (3), vertical, v = 0 at the peak | y_max = h + (v₀ sin θ)² / 2g |
| Time to peak | (1), vertical, v = 0 at the peak | t_peak = v₀ sin θ / g |
| Total flight time | (2), vertical, Δy = −h | t = [v₀ sin θ + √((v₀ sin θ)² + 2gh)] / g |
| Range | (2), horizontal, a = 0 | R = v₀ cos θ · t_flight |

From level ground (h = 0), these reduce to t = 2v₀ sin θ / g and R = v₀² sin 2θ / g. The range is greatest at θ = 45°.

**Assumptions:** no air resistance, constant gravity, flat ground, and a point-mass projectile.

## Validation

The tests in [`tests/test_physics.py`](tests/test_physics.py) check the model against textbook results:

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
| Trajectory consistency | Lands at y = 0 at x = R; v_y = 0 at the peak |

## Running locally

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
streamlit run app.py          # opens http://localhost:8501
pytest                        # run the tests
```

## Project structure

```
physics.py           The three kinematic equations and the projectile solver
app.py               Streamlit user interface (simulator + mathematical models tabs)
tests/               Validation tests (pytest)
```

## Built with Claude Code

This project was developed in VS Code with [Claude Code](https://claude.com/claude-code) as an AI pair programmer.
