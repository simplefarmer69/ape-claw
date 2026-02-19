const fs = require("fs");
const path = require("path");

let cards = null;

function loadCards() {
  if (cards) return cards;
  const fp = path.join(process.cwd(), "data", "skills-cards.json");
  cards = JSON.parse(fs.readFileSync(fp, "utf8"));
  return cards;
}

module.exports = (req, res) => {
  const slug = (req.query.slug || "").trim().toLowerCase();
  if (!slug) {
    res.status(400).json({ ok: false, error: "Missing ?slug= parameter" });
    return;
  }

  try {
    const db = loadCards();
    const card = db[slug];
    if (!card) {
      res.status(404).json({ ok: false, error: "Skill not found: " + slug });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ ok: true, card });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Internal error" });
  }
};
