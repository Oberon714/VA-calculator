const BODY_PARTS = [
  { value: "none", label: "None" },
  { value: "leftArm", label: "Left arm" },
  { value: "rightArm", label: "Right arm" },
  { value: "leftLeg", label: "Left leg" },
  { value: "rightLeg", label: "Right leg" },
];
const RATINGS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const rowsBody = document.getElementById("rows-body");
const addRowBtn = document.getElementById("add-row");

function createRow(desc = "", bodyPart = "none", pct = 10) {
  const tr = document.createElement("tr");

  const partOptions = BODY_PARTS.map(
    (p) => `<option value="${p.value}" ${p.value === bodyPart ? "selected" : ""}>${p.label}</option>`
  ).join("");

  const pctOptions = RATINGS.map(
    (r) => `<option value="${r}" ${r === pct ? "selected" : ""}>${r}%</option>`
  ).join("");

  tr.innerHTML = `
    <td class="col-desc"><input type="text" class="input-desc" placeholder="e.g. Tinnitus" value="${desc}"></td>
    <td class="col-part"><select class="input-part">${partOptions}</select></td>
    <td class="col-pct"><select class="input-pct">${pctOptions}</select></td>
    <td class="col-remove"><button type="button" class="btn-remove">Remove</button></td>
  `;

  tr.querySelector(".btn-remove").addEventListener("click", () => {
    tr.remove();
    recalculate();
  });
  tr.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", recalculate);
    el.addEventListener("change", recalculate);
  });

  rowsBody.appendChild(tr);
}

addRowBtn.addEventListener("click", () => {
  createRow();
  recalculate();
});

function readRows() {
  return Array.from(rowsBody.querySelectorAll("tr")).map((tr) => ({
    desc: tr.querySelector(".input-desc").value.trim() || "Unnamed condition",
    bodyPart: tr.querySelector(".input-part").value,
    pct: Number(tr.querySelector(".input-pct").value),
  })).filter((r) => r.pct > 0);
}

// VA combined ratings table formula: each successive rating applies to the
// remaining "able-bodied" percentage, rounded to the nearest whole number
// at each step (matches the official combined ratings table).
function combineSequential(values) {
  const sorted = [...values].sort((a, b) => b - a);
  let running = 0;
  const steps = [];
  for (const v of sorted) {
    const before = running;
    running = Math.round(running + (v * (100 - running)) / 100);
    steps.push({ value: v, before, after: running });
  }
  return { total: running, steps };
}

function recalculate() {
  const rows = readRows();

  if (rows.length === 0) {
    renderEmpty();
    return;
  }

  const armEntries = rows.filter((r) => r.bodyPart === "leftArm" || r.bodyPart === "rightArm");
  const legEntries = rows.filter((r) => r.bodyPart === "leftLeg" || r.bodyPart === "rightLeg");

  const armsBilateral = armEntries.some((r) => r.bodyPart === "leftArm") && armEntries.some((r) => r.bodyPart === "rightArm");
  const legsBilateral = legEntries.some((r) => r.bodyPart === "leftLeg") && legEntries.some((r) => r.bodyPart === "rightLeg");

  const bilateralEntries = [
    ...(armsBilateral ? armEntries : []),
    ...(legsBilateral ? legEntries : []),
  ];
  const nonBilateralEntries = rows.filter((r) => !bilateralEntries.includes(r));

  let bilateralInfo = null;
  let poolValues = rows.map((r) => r.pct);

  if (bilateralEntries.length > 0) {
    const group = combineSequential(bilateralEntries.map((r) => r.pct));
    const adjusted = Math.round(group.total * 1.1);
    bilateralInfo = {
      entries: bilateralEntries,
      combined: group.total,
      adjusted,
    };
    poolValues = [adjusted, ...nonBilateralEntries.map((r) => r.pct)];
  }

  const result = combineSequential(poolValues);
  const finalRounded = Math.round(result.total / 10) * 10;

  renderResults(bilateralInfo, result, finalRounded);
}

function renderEmpty() {
  document.getElementById("final-value").textContent = "0%";
  document.getElementById("meter-fill").style.width = "0%";
  document.getElementById("bilateral-note-slot").innerHTML = "";
  document.getElementById("breakdown-slot").innerHTML = '<p class="empty-state">Add at least one disability to see the calculation.</p>';
}

function renderResults(bilateralInfo, result, finalRounded) {
  document.getElementById("final-value").textContent = finalRounded + "%";
  document.getElementById("meter-fill").style.width = Math.min(finalRounded, 100) + "%";

  const noteSlot = document.getElementById("bilateral-note-slot");
  if (bilateralInfo) {
    const list = bilateralInfo.entries.map((e) => `${e.desc} (${e.pct}%)`).join(", ");
    noteSlot.innerHTML = `
      <div class="bilateral-note">
        <b>Bilateral factor applied.</b> ${list} combine to ${bilateralInfo.combined}%,
        then increased 10% per 38 CFR &sect;4.26 to <b>${bilateralInfo.adjusted}%</b> before combining with the rest.
      </div>
    `;
  } else {
    noteSlot.innerHTML = "";
  }

  const stepRows = result.steps.map(
    (s) => `<tr><td>${s.value}%</td><td class="running">${s.before}% &rarr; ${s.after}%</td></tr>`
  ).join("");

  document.getElementById("breakdown-slot").innerHTML = `
    <table class="breakdown-table">
      <thead><tr><th>Rating applied</th><th>Running total</th></tr></thead>
      <tbody>${stepRows}</tbody>
    </table>
    <p class="meter-caption" style="margin-top:10px;">Exact total before final rounding: ${result.total}% &rarr; rounded to nearest 10: <b>${finalRounded}%</b></p>
  `;
}

// Seed with two starter rows
createRow("", "none", 30);
createRow("", "none", 20);
recalculate();
