"""Streamlit web app for the projectile motion simulator.

Run with:  streamlit run app.py
"""

import numpy as np
import plotly.graph_objects as go
import streamlit as st

from physics import GRAVITY_PRESETS, solve

st.set_page_config(page_title="Projectile Motion Simulator", page_icon="🎯", layout="wide")

PATH_COLOR = "#2563eb"
BALL_COLOR = "#dc2626"
VX_COLOR = "#16a34a"
VY_COLOR = "#9333ea"
PINNED_COLORS = ["#64748b", "#d97706", "#0891b2", "#be185d", "#4d7c0f"]

if "pinned" not in st.session_state:
    st.session_state.pinned = []

# --- Inputs -----------------------------------------------------------------
with st.sidebar:
    st.header("Launch parameters")
    speed = st.slider("Launch speed, v₀ (m/s)", 0.0, 100.0, 25.0, 0.5)
    angle = st.slider("Launch angle, θ (degrees)", 0.0, 90.0, 45.0, 0.5)
    height = st.slider("Launch height, h (m)", 0.0, 100.0, 0.0, 0.5)

    st.header("Gravity")
    planet = st.selectbox("Location", [*GRAVITY_PRESETS, "Custom"])
    if planet == "Custom":
        g = st.slider("g (m/s²)", 0.5, 30.0, 9.81, 0.01)
    else:
        g = GRAVITY_PRESETS[planet]
        st.caption(f"g = {g} m/s²")

    st.header("Display")
    playback = st.select_slider("Playback speed", [0.25, 0.5, 1.0, 2.0, 5.0, 10.0], value=1.0,
                                format_func=lambda s: f"{s:g}×")
    show_vectors = st.toggle("Show velocity vectors", value=True)

    st.header("Compare")
    if st.button("📌 Pin current trajectory", width="stretch"):
        st.session_state.pinned.append(dict(speed=speed, angle=angle, height=height, g=g))
    if st.session_state.pinned and st.button("Clear pinned", width="stretch"):
        st.session_state.pinned = []

traj = solve(speed, angle, height, g)

st.title("🎯 Projectile Motion Simulator")
sim_tab, math_tab = st.tabs(["🚀 Simulator", "📘 Mathematical models"])

# --- Simulator tab ----------------------------------------------------------
with sim_tab:
    cols = st.columns(4)
    cols[0].metric("Range", f"{traj.range:.2f} m")
    cols[1].metric("Maximum height", f"{traj.max_height:.2f} m")
    cols[2].metric("Total flight time", f"{traj.flight_time:.2f} s")
    cols[3].metric("Impact speed", f"{traj.impact_speed:.2f} m/s")

    pinned = [(p, solve(p["speed"], p["angle"], p["height"], p["g"])) for p in st.session_state.pinned]

    # Axis limits cover the current and pinned paths, with headroom for the arrows
    x_max = max([traj.range] + [t.range for _, t in pinned]) * 1.08 + 1
    y_max = max([traj.max_height] + [t.max_height for _, t in pinned]) * 1.2 + 1
    arrow_scale = 0.12 * max(x_max, y_max) / speed if speed > 0 else 0.0

    fig = go.Figure()
    for i, (p, t_pin) in enumerate(pinned):
        _, px, py = t_pin.sample()
        fig.add_trace(go.Scatter(
            x=px, y=py, mode="lines", line=dict(color=PINNED_COLORS[i % len(PINNED_COLORS)], width=1.5),
            name=f"Pinned: {p['speed']:g} m/s, {p['angle']:g}°, h={p['height']:g} m",
        ))

    t_all, x_all, y_all = traj.sample()
    fig.add_trace(go.Scatter(x=x_all, y=y_all, mode="lines", name="Predicted path",
                             line=dict(color=PATH_COLOR, width=1.5, dash="dot")))

    # Peak and landing markers
    peak_x, _ = traj.position(traj.time_to_peak)
    fig.add_trace(go.Scatter(
        x=[peak_x, traj.range], y=[traj.max_height, 0], mode="markers+text", name="Peak / landing",
        marker=dict(symbol=["triangle-up", "x"], size=10, color=PATH_COLOR),
        text=[f"peak {traj.max_height:.1f} m", f"lands {traj.range:.1f} m"],
        textposition=["top center", "top left"], showlegend=False,
    ))

    # Animated traces: traced path, ball, velocity vectors, live readout
    def animated_traces(t):
        x, y = traj.position(t)
        y = max(y, 0.0)
        vx, vy = traj.velocity(t)
        trail_t = t_all[t_all <= t]
        trail_x, trail_y = traj.position(trail_t)
        readout = (f"t = {t:5.2f} s<br>x = {x:6.2f} m<br>y = {y:6.2f} m<br>"
                   f"vₓ = {vx:6.2f} m/s<br>v_y = {vy:6.2f} m/s")
        arrow = dict(symbol="arrow", angleref="previous", size=[0, 11])
        traces = [
            go.Scatter(x=np.append(trail_x, x), y=np.append(np.maximum(trail_y, 0), y)),
            go.Scatter(x=[x], y=[y]),
            go.Scatter(x=[x, x + vx * arrow_scale], y=[y, y], marker=arrow),
            go.Scatter(x=[x, x], y=[y, y + vy * arrow_scale], marker=arrow),
            go.Scatter(text=[readout]),
        ]
        return traces

    first = len(fig.data)
    start = animated_traces(0.0)
    fig.add_trace(start[0].update(mode="lines", name="Projectile path", line=dict(color=PATH_COLOR, width=3)))
    fig.add_trace(start[1].update(mode="markers", name="Projectile",
                                  marker=dict(size=14, color=BALL_COLOR, line=dict(width=1, color="white"))))
    fig.add_trace(start[2].update(mode="lines+markers", name="vₓ (horizontal velocity)",
                                  line=dict(color=VX_COLOR, width=3), marker_color=VX_COLOR,
                                  visible=show_vectors))
    fig.add_trace(start[3].update(mode="lines+markers", name="v_y (vertical velocity)",
                                  line=dict(color=VY_COLOR, width=3), marker_color=VY_COLOR,
                                  visible=show_vectors))
    fig.add_trace(start[4].update(x=[x_max * 0.01], y=[y_max * 0.98], mode="text", showlegend=False,
                                  textposition="bottom right", textfont=dict(family="monospace", size=13)))
    animated = list(range(first, len(fig.data)))

    # Frames are spaced in real (simulated) time, divided by the playback speed.
    # Aim for ~30 ms per frame so short flights stay smooth and long ones aren't huge.
    real_ms = traj.flight_time * 1000 / playback
    n_frames = int(np.clip(real_ms / 30, 10, 200))
    frame_ms = real_ms / n_frames
    frame_times = np.linspace(0, traj.flight_time, n_frames + 1)
    fig.frames = [go.Frame(name=f"{t:.3f}", data=animated_traces(t), traces=animated) for t in frame_times]

    play_args = dict(frame=dict(duration=frame_ms, redraw=False), transition=dict(duration=0),
                     fromcurrent=True, mode="immediate")
    fig.update_layout(
        xaxis=dict(title="Horizontal distance, x (m)", range=[0, x_max], constrain="domain"),
        yaxis=dict(title="Height, y (m)", range=[0, y_max], scaleanchor="x", scaleratio=1),
        height=600,
        margin=dict(t=40, b=10),
        legend=dict(orientation="h", y=1.08),
        updatemenus=[dict(type="buttons", direction="left", x=0, y=-0.12, xanchor="left", yanchor="top",
                          showactive=False, buttons=[
            dict(label="▶ Launch", method="animate", args=[None, play_args]),
            dict(label="⏸ Pause", method="animate",
                 args=[[None], dict(frame=dict(duration=0, redraw=False), mode="immediate")]),
        ])],
        sliders=[dict(
            x=0.18, y=-0.08, len=0.82, currentvalue=dict(prefix="t = ", suffix=" s"),
            steps=[dict(label=f"{t:.2f}", method="animate",
                        args=[[f"{t:.3f}"], dict(frame=dict(duration=0, redraw=False), mode="immediate")])
                   for t in frame_times],
        )],
    )
    st.plotly_chart(fig, width="stretch")
    st.caption("Press **▶ Launch** to fly the projectile in real time (at the chosen playback speed), "
               "or drag the time slider to scrub. Any parameter change redraws the path instantly.")

    if pinned:
        st.subheader("Pinned trajectories")
        st.dataframe(
            [dict(Speed=f"{p['speed']:g} m/s", Angle=f"{p['angle']:g}°", Height=f"{p['height']:g} m",
                  g=f"{p['g']:g} m/s²", Range=f"{t.range:.2f} m", **{"Max height": f"{t.max_height:.2f} m"},
                  **{"Flight time": f"{t.flight_time:.2f} s"}) for p, t in pinned],
            hide_index=True, width="stretch",
        )

    with st.expander("Trajectory data"):
        t_tab = np.linspace(0, traj.flight_time, 21)
        x_tab, y_tab = traj.position(t_tab)
        vx_tab, vy_tab = traj.velocity(t_tab)
        rows = [{"t (s)": round(a, 3), "x (m)": round(b, 3), "y (m)": round(max(c, 0), 3),
                 "vₓ (m/s)": round(d, 3), "v_y (m/s)": round(e, 3)}
                for a, b, c, d, e in zip(t_tab, x_tab, y_tab, np.broadcast_to(vx_tab, t_tab.shape), vy_tab)]
        st.dataframe(rows, hide_index=True, width="stretch")

# --- Mathematical models tab ------------------------------------------------
with math_tab:
    st.header("The three kinematic equations")
    st.markdown("Every number in this simulator comes from these three equations for motion "
                "with **constant acceleration** $a$ along a straight line:")
    st.latex(r"\textbf{(1)}\quad v = v_0 + a t")
    st.latex(r"\textbf{(2)}\quad \Delta x = v_0 t + \tfrac{1}{2} a t^2")
    st.latex(r"\textbf{(3)}\quad v^2 = v_0^2 + 2 a \Delta x")
    st.markdown(
        "Here $v_0$ is the initial velocity, $v$ the velocity after time $t$, and $\\Delta x$ the "
        "displacement. **Assumptions:** no air resistance, constant gravity $g$, flat ground, and "
        "the projectile is treated as a point."
    )

    st.header("Setting up the problem")
    st.markdown(
        "The key idea is that horizontal and vertical motion are **independent**. We apply the "
        "equations to each axis separately. Splitting the launch velocity into components:"
    )
    st.latex(r"v_{0x} = v_0\cos\theta \qquad v_{0y} = v_0\sin\theta")
    st.markdown(
        "| | Horizontal (x) | Vertical (y) |\n|---|---|---|\n"
        "| Initial velocity | $v_{0x} = v_0\\cos\\theta$ | $v_{0y} = v_0\\sin\\theta$ |\n"
        "| Acceleration | $a_x = 0$ | $a_y = -g$ |\n"
        "| Start position | $x = 0$ | $y = h$ |\n"
    )
    st.markdown("Because $a_x = 0$, equation (1) says $v_x = v_{0x}$ stays constant for the whole flight.")

    st.header("Maximum height")
    st.markdown(
        "At the top of its arc the projectile stops rising for an instant, so $v_y = 0$. "
        "Apply **equation (3)** vertically, with $a = -g$:"
    )
    st.latex(r"0 = v_{0y}^2 - 2g\,\Delta y \quad\Longrightarrow\quad \Delta y = \frac{v_{0y}^2}{2g}")
    st.latex(r"\boxed{\,y_{max} = h + \frac{(v_0\sin\theta)^2}{2g}\,}")
    st.markdown("The time it takes to get there follows from **equation (1)** with $v_y = 0$:")
    st.latex(r"0 = v_{0y} - g\,t_{peak} \quad\Longrightarrow\quad t_{peak} = \frac{v_0\sin\theta}{g}")

    st.header("Total flight time")
    st.markdown(
        "The flight ends when the projectile hits the ground, which is a vertical displacement "
        "of $\\Delta y = -h$. Apply **equation (2)** vertically:"
    )
    st.latex(r"-h = v_{0y}\,t - \tfrac{1}{2} g t^2 \quad\Longrightarrow\quad \tfrac{1}{2} g t^2 - v_{0y}\,t - h = 0")
    st.markdown("This is a quadratic in $t$. The quadratic formula gives one positive root:")
    st.latex(r"\boxed{\,t_{flight} = \frac{v_0\sin\theta + \sqrt{(v_0\sin\theta)^2 + 2gh}}{g}\,}")
    st.markdown(
        "**Special case, launched from the ground ($h = 0$):** "
        "$t_{flight} = \\dfrac{2v_0\\sin\\theta}{g} = 2\\,t_{peak}$. The way up and the way down take "
        "equal time."
    )

    st.header("Range")
    st.markdown(
        "Horizontally there is no acceleration, so **equation (2)** with $a_x = 0$ reduces to "
        "distance = velocity × time. Use the flight time found above:"
    )
    st.latex(r"\boxed{\,R = v_{0x}\,t_{flight} = v_0\cos\theta \cdot t_{flight}\,}")
    st.markdown("**Special case, $h = 0$:** substitute $t_{flight} = 2v_0\\sin\\theta / g$ and use "
                "$2\\sin\\theta\\cos\\theta = \\sin 2\\theta$:")
    st.latex(r"R = \frac{v_0^2 \sin 2\theta}{g}")
    st.markdown(
        "$\\sin 2\\theta$ is largest when $2\\theta = 90°$, so from level ground the **maximum range is at "
        "θ = 45°**. Complementary angles such as 30° and 60° give the same range. From a raised "
        "launch point ($h > 0$) the best angle is a little below 45°. Try it with the sliders."
    )

    st.header("Worked example: your current settings")
    st.markdown(f"With $v_0 = {speed:g}$ m/s, $\\theta = {angle:g}°$, $h = {height:g}$ m, "
                f"and $g = {g:g}$ m/s²:")
    st.latex(rf"v_{{0x}} = {speed:g}\cos {angle:g}° = {traj.v0x:.3f}\ \text{{m/s}} \qquad "
             rf"v_{{0y}} = {speed:g}\sin {angle:g}° = {traj.v0y:.3f}\ \text{{m/s}}")
    st.latex(rf"y_{{max}} = {height:g} + \frac{{{traj.v0y:.3f}^2}}{{2({g:g})}} = {traj.max_height:.3f}\ \text{{m}}"
             rf"\qquad t_{{peak}} = \frac{{{traj.v0y:.3f}}}{{{g:g}}} = {traj.time_to_peak:.3f}\ \text{{s}}")
    st.latex(rf"t_{{flight}} = \frac{{{traj.v0y:.3f} + \sqrt{{{traj.v0y:.3f}^2 + 2({g:g})({height:g})}}}}{{{g:g}}}"
             rf" = {traj.flight_time:.3f}\ \text{{s}}")
    st.latex(rf"R = {traj.v0x:.3f} \times {traj.flight_time:.3f} = {traj.range:.3f}\ \text{{m}}")
