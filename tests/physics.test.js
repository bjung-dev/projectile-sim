/* Check the simulator against known textbook results. Open tests/index.html to run. */
const { G, solve, velocity, displacement, finalSpeedSquared } = Physics;
const rad = (deg) => (deg * Math.PI) / 180;

test("kinematic equations agree", () => {
  // Equation (3) follows from (1) and (2); check they are consistent
  const [v0, a, t] = [7, -3, 2.5];
  const v = velocity(v0, a, t);
  approx(v * v, finalSpeedSquared(v0, a, displacement(v0, a, t)));
});

test("range at 45° from the ground is v²/g", () => {
  approx(solve(20, 45).range, 20 ** 2 / G);
});

test("range from the ground is v² sin 2θ / g", () => {
  approx(solve(18, 27).range, (18 ** 2 * Math.sin(rad(54))) / G);
});

test("straight up: h_max = v²/2g, t = 2v/g, R = 0", () => {
  const traj = solve(15, 90);
  approx(traj.maxHeight, 15 ** 2 / (2 * G));
  approx(traj.flightTime, (2 * 15) / G);
  approx(traj.range, 0);
});

test("from the ground, flight time is twice the time to peak", () => {
  const traj = solve(30, 60);
  approx(traj.flightTime, 2 * traj.timeToPeak);
});

test("horizontal launch from a cliff: t = √(2h/g)", () => {
  const traj = solve(10, 0, 20);
  const t = Math.sqrt((2 * 20) / G);
  approx(traj.flightTime, t);
  approx(traj.range, 10 * t);
  approx(traj.maxHeight, 20);
});

test("complementary angles give the same range", () => {
  approx(solve(25, 30).range, solve(25, 60).range);
});

test("best angle is 45° from the ground and lower from a height", () => {
  const best = (h) => {
    let bestAngle = 0;
    for (let a = 0; a <= 90; a += 0.5) if (solve(30, a, h).range > solve(30, bestAngle, h).range) bestAngle = a;
    return bestAngle;
  };
  approx(best(0), 45);
  assert(best(40) < 45, `expected best angle below 45°, got ${best(40)}`);
});

test("impact speed matches energy conservation: v² = v₀² + 2gh", () => {
  approx(solve(12, 35, 8).impactSpeed, Math.sqrt(12 ** 2 + 2 * G * 8));
});

test("trajectory lands at the range and peaks at the max height", () => {
  const traj = solve(22, 50, 3, 3.71);
  const end = traj.position(traj.flightTime);
  approx(end.x, traj.range);
  approx(end.y, 0);
  approx(traj.position(traj.timeToPeak).y, traj.maxHeight);
  approx(traj.velocity(traj.timeToPeak).vy, 0);
  assert(Math.max(...traj.sample().map((p) => p.y)) <= traj.maxHeight + 1e-9, "sampled path exceeds max height");
});

test("lower gravity flies farther", () => {
  assert(solve(20, 45, 0, 1.62).range > solve(20, 45, 0, 9.81).range);
});

test("invalid inputs throw", () => {
  throws(() => solve(10, 45, 0, 0));
  throws(() => solve(-1, 45));
  throws(() => solve(10, 45, -2));
});
