(() => {
  const task = window.ARB_DATA?.tasks.find(
    candidate => candidate.name === "FasterGCG candidate token ranking",
  );
  const run = task?.models.find(candidate => candidate.model === "vesper-pro");
  if (!task || !run) return;

  const cutoffHours = 11.9;
  run.points = run.points.filter(point => point.seconds <= cutoffHours * 3600);
  run.submissions = run.points.length;
  run.safetyFilterCutoffHours = cutoffHours;
  task.safetyFilterCutoffHours = cutoffHours;
})();
