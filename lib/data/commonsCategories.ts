// Wikimedia Commons category per artist/atelier — the live gallery pulls ALL
// image files from these categories at runtime. If a category is missing or
// empty, the API route falls back to a Commons name search, so galleries still
// fill. Keyed by artist id (see lib/data/artists.ts).
export const commonsCategories: Record<string, string> = {
  // World — painters
  "a-vangogh": "Paintings by Vincent van Gogh",
  "a-vermeer": "Paintings by Johannes Vermeer",
  "a-rembrandt": "Paintings by Rembrandt",
  "a-leonardo": "Paintings by Leonardo da Vinci",
  "a-botticelli": "Paintings by Sandro Botticelli",
  "a-michelangelo": "Paintings by Michelangelo Buonarroti",
  "a-raphael": "Paintings by Raphael",
  "a-monet": "Paintings by Claude Monet",
  "a-hokusai": "Thirty-six Views of Mount Fuji by Hokusai",
  "a-klimt": "Paintings by Gustav Klimt",
  "a-caravaggio": "Paintings by Caravaggio",

  // India — modern painters
  "a-ravivarma": "Paintings by Raja Ravi Varma",
  "a-abanindranath": "Paintings by Abanindranath Tagore",
  "a-shergil": "Paintings by Amrita Sher-Gil",

  // India — ateliers / monuments
  "a-indus": "Art of the Indus Valley Civilisation",
  "a-shunga": "Sanchi",
  "a-gupta": "Gupta art",
  "a-ajanta": "Paintings in the Ajanta Caves",
  "a-pallava": "Group of Monuments at Mahabalipuram",
  "a-chalukya": "Pattadakal",
  "a-ellora": "Kailasa Temple, Ellora",
  "a-chola": "Chola bronzes",
  "a-khajuraho": "Khajuraho Group of Monuments",
  "a-konark": "Konark Sun Temple",
  "a-vijayanagara": "Hampi",
  "a-mughal": "Mughal paintings",
  "a-rajput": "Rajput paintings",
};
