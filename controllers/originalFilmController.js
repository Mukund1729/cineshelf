import {
  getOriginalFilm,
  getOriginalFilmPerson,
  listOriginalFilms,
  searchOriginalFilmsAndPeople,
} from '../services/originalFilmService.js';

const isValidSlug = value => /^[a-z0-9-]{1,80}$/.test(value || '');

export async function getOriginalFilms(req, res) {
  try {
    res.json({ success: true, results: await listOriginalFilms() });
  } catch (error) {
    console.error('[Original films] List failed:', error.message);
    res.status(500).json({ success: false, error: 'original_films_unavailable' });
  }
}

export async function getOriginalFilmBySlug(req, res) {
  try {
    if (!isValidSlug(req.params.slug)) {
      return res.status(400).json({ success: false, error: 'invalid_film_slug' });
    }
    const film = await getOriginalFilm(req.params.slug);
    if (!film) return res.status(404).json({ success: false, error: 'original_film_not_found' });
    return res.json({ success: true, data: film });
  } catch (error) {
    console.error('[Original films] Detail failed:', error.message);
    return res.status(500).json({ success: false, error: 'original_film_unavailable' });
  }
}

export async function searchOriginalFilmCatalog(req, res) {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const data = await searchOriginalFilmsAndPeople(query);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('[Original films] Search failed:', error.message);
    res.status(500).json({ success: false, error: 'original_film_search_unavailable' });
  }
}

export async function getOriginalFilmPersonProfile(req, res) {
  try {
    if (!isValidSlug(req.params.slug)) {
      return res.status(400).json({ success: false, error: 'invalid_person_slug' });
    }
    const person = await getOriginalFilmPerson(req.params.slug);
    if (!person) return res.status(404).json({ success: false, error: 'original_person_not_found' });
    return res.json({ success: true, data: person });
  } catch (error) {
    console.error('[Original films] Person profile failed:', error.message);
    return res.status(500).json({ success: false, error: 'original_person_unavailable' });
  }
}
