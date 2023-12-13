const transferSelection = (selection) => {
  return Object.fromEntries(selection.map((s) => [s, 1]));
};

module.exports = {
  transferSelection,
};
