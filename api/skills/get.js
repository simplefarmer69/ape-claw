const cards = require("../../data/skills-cards.json");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");

  const slug = (req.query.slug || "").trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ ok: false, error: "Missing ?slug= parameter" });
  }

  const card = cards[slug];
  if (!card) {
    return res.status(404).json({ ok: false, error: "Skill not found: " + slug });
  }

  return res.status(200).json({ ok: true, card });
};
